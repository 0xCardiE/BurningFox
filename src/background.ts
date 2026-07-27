/**
 * Holds an unlocked session across popup opens. Popup JS reloads when the
 * action popup closes; the service worker + chrome.storage.session survive.
 */
import {
  connectOrigin,
  disconnectOrigin,
  faviconForTab,
  isOriginConnected,
  originFromUrl,
  queryActiveBrowserTab,
} from './lib/dappConnections';
import { addressFromPrivateKey } from './lib/backgroundSign';
import { handleProviderRpc } from './lib/providerRpc';
import {
  loadPersisted,
  WALLET_PERSIST_KEY,
  effectiveToolbarOpenMode,
  effectiveActiveChainId,
} from './lib/storageState';
import type { ProviderRequest, ProviderResponse } from './provider/types';
import { toHexChainId } from './provider/types';
import { getAddress } from 'viem';

const POPUP_PATH = 'index.html';

async function loadPersistedSettingsOnStart(): Promise<void> {
  try {
    await loadPersisted();
  } catch {
    /* ignore */
  }
}

async function syncToolbarOpenModeFromSettings(): Promise<void> {
  try {
    const { settings } = await loadPersisted();
    const mode = effectiveToolbarOpenMode(settings);
    const side = chrome.sidePanel;
    if (!side?.setPanelBehavior) {
      await chrome.action.setPopup({ popup: POPUP_PATH });
      return;
    }
    if (mode === 'side_panel') {
      await chrome.action.setPopup({ popup: '' });
      await side.setPanelBehavior({ openPanelOnActionClick: true });
    } else {
      await side.setPanelBehavior({ openPanelOnActionClick: false });
      await chrome.action.setPopup({ popup: POPUP_PATH });
    }
  } catch {
    /* ignore */
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void syncToolbarOpenModeFromSettings();
  void loadPersistedSettingsOnStart();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[WALLET_PERSIST_KEY]) return;
  void syncToolbarOpenModeFromSettings();
});

void syncToolbarOpenModeFromSettings();
void loadPersistedSettingsOnStart();

const SESSION_KEY = 'burning_fox_session_pk';
/** Legacy session keys — read once then cleared after unlock. */
const LEGACY_SESSION_KEYS = ['jumpa_session_pk', 'beewallet_session_pk'] as const;
const ACTIVITY_KEY = 'burning_fox_last_activity';
const LEGACY_ACTIVITY_KEYS = ['jumpa_last_activity', 'beewallet_last_activity'] as const;

let memoryPk: string | null = null;

async function emitToTab(
  tabId: number,
  event: { type: string; chainId?: string; accounts?: string[] },
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PROVIDER_EMIT', event });
  } catch {
    /* content script may be unavailable — try MAIN-world inject below */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (ev: { type: string; chainId?: string; accounts?: string[] }) => {
        const channel = 'burning-fox-provider';
        window.postMessage({ channel, target: 'inpage', type: 'event', event: ev }, '*');
        const eth = (window as Window & { ethereum?: { request?: (a: unknown) => Promise<unknown> } })
          .ethereum;
        if (ev.type === 'accountsChanged' && eth?.request && Array.isArray(ev.accounts)) {
          /* nudge dapps that only poll eth_accounts after user gesture */
          void eth.request({ method: 'eth_accounts' }).catch(() => undefined);
        }
      },
      args: [event],
    });
  } catch {
    /* scripting may be blocked on this tab */
  }
}

async function openWalletUi(tabId?: number): Promise<void> {
  try {
    const side = chrome.sidePanel;
    if (side?.open && tabId != null) {
      await side.open({ tabId });
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    await chrome.action.openPopup();
  } catch {
    /* popup may already be open / not allowed */
  }
}

async function buildDappConnectionStatus(): Promise<{
  ok: true;
  tab: {
    tabId: number;
    url: string;
    title: string;
    origin: string;
    hostname: string;
    favIconUrl?: string;
  } | null;
  connected: boolean;
  canConnect: boolean;
  reason?: string;
}> {
  const tab = await queryActiveBrowserTab();
  if (!tab?.id || !tab.url) {
    return {
      ok: true,
      tab: null,
      connected: false,
      canConnect: false,
      reason: 'No active browser tab',
    };
  }
  const origin = originFromUrl(tab.url);
  if (!origin) {
    return {
      ok: true,
      tab: null,
      connected: false,
      canConnect: false,
      reason: 'Open an http(s) dapp tab to connect',
    };
  }
  const hostname = new URL(tab.url).hostname;
  const connected = await isOriginConnected(origin);
  return {
    ok: true,
    tab: {
      tabId: tab.id,
      url: tab.url,
      title: tab.title?.trim() || hostname,
      origin,
      hostname,
      favIconUrl: faviconForTab(tab),
    },
    connected,
    canConnect: true,
  };
}

type Msg =
  | { type: 'GET_SESSION' }
  | { type: 'SET_SESSION'; privateKeyHex: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'PING' }
  | { type: 'SYNC_TOOLBAR_OPEN_MODE' }
  | { type: 'PROVIDER_GET_CONFIG' }
  | { type: 'PROVIDER_RPC'; request: ProviderRequest; origin?: string }
  | { type: 'GET_DAPP_CONNECTION' }
  | { type: 'CONNECT_ACTIVE_TAB' }
  | { type: 'DISCONNECT_ACTIVE_TAB' };

async function sessionPrivateKey(): Promise<`0x${string}` | null> {
  await maybeAutoLockExpired();
  if (memoryPk && isValidPkHex(memoryPk)) return memoryPk;
  const data = await chrome.storage.session.get([
    SESSION_KEY,
    ...LEGACY_SESSION_KEYS,
  ]);
  let hex = data[SESSION_KEY];
  if (!hex) {
    for (const k of LEGACY_SESSION_KEYS) {
      if (data[k]) {
        hex = data[k];
        break;
      }
    }
  }
  if (typeof hex === 'string' && isValidPkHex(hex)) {
    memoryPk = hex;
    void chrome.storage.session.set({ [SESSION_KEY]: memoryPk });
    void chrome.storage.session.remove(LEGACY_SESSION_KEYS);
    return memoryPk;
  }
  return null;
}

function isValidPkHex(s: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(s);
}

async function touchActivity(): Promise<void> {
  await chrome.storage.session.set({ [ACTIVITY_KEY]: Date.now() });
}

async function maybeAutoLockExpired(): Promise<void> {
  try {
    const { settings } = await loadPersisted();
    const mins = settings.autoLockMinutes ?? 0;
    if (!Number.isFinite(mins) || mins <= 0) return;
    const data = await chrome.storage.session.get([
      ACTIVITY_KEY,
      ...LEGACY_ACTIVITY_KEYS,
    ]);
    const times = [data[ACTIVITY_KEY], ...LEGACY_ACTIVITY_KEYS.map(k => data[k])].filter(
      (v): v is number => typeof v === 'number',
    );
    const last = times.length ? Math.max(...times) : 0;
    if (!last) return;
    if (Date.now() - last > mins * 60 * 1000) {
      memoryPk = null;
      await chrome.storage.session.remove([
        SESSION_KEY,
        ...LEGACY_SESSION_KEYS,
        ACTIVITY_KEY,
        ...LEGACY_ACTIVITY_KEYS,
      ]);
    }
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener(
  (message: Msg, sender, sendResponse: (r: unknown) => void) => {
    if (!message || typeof message !== 'object') return;

    if (message.type === 'PING') {
      void (async () => {
        try {
          await touchActivity();
          sendResponse({ ok: true });
        } catch {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === 'SYNC_TOOLBAR_OPEN_MODE') {
      void (async () => {
        try {
          await syncToolbarOpenModeFromSettings();
          sendResponse({ ok: true });
        } catch {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === 'PROVIDER_GET_CONFIG') {
      void (async () => {
        try {
          const { settings } = await loadPersisted();
          sendResponse({ ok: true, replaceMetaMask: settings.replaceMetaMask !== false });
        } catch {
          sendResponse({ ok: true, replaceMetaMask: true });
        }
      })();
      return true;
    }

    if (message.type === 'PROVIDER_RPC' && message.request) {
      void (async () => {
        try {
          const pk = await sessionPrivateKey();
          const origin =
            message.origin ??
            (sender.url ? originFromUrl(sender.url) ?? undefined : undefined);
          const res = await handleProviderRpc(pk, message.request, origin);
          if (
            !pk &&
            message.request.method === 'eth_requestAccounts' &&
            !res.ok
          ) {
            void openWalletUi(sender.tab?.id);
          }
          sendResponse(res);
        } catch (e) {
          sendResponse({
            id: message.request.id,
            ok: false,
            error: { code: 4001, message: e instanceof Error ? e.message : String(e) },
          } satisfies ProviderResponse);
        }
      })();
      return true;
    }

    if (message.type === 'GET_DAPP_CONNECTION') {
      void (async () => {
        try {
          sendResponse(await buildDappConnectionStatus());
        } catch {
          sendResponse({
            ok: false,
            tab: null,
            connected: false,
            canConnect: false,
            reason: 'Could not read active tab',
          });
        }
      })();
      return true;
    }

    if (message.type === 'CONNECT_ACTIVE_TAB') {
      void (async () => {
        try {
          const pk = await sessionPrivateKey();
          if (!pk) {
            void openWalletUi();
            sendResponse({ ok: false, error: 'Unlock Burning Fox first' });
            return;
          }
          const status = await buildDappConnectionStatus();
          if (!status.tab?.origin) {
            sendResponse({ ok: false, error: status.reason ?? 'No connectable tab' });
            return;
          }
          await connectOrigin(status.tab.origin);
          const addr = getAddress(addressFromPrivateKey(pk));
          const { settings } = await loadPersisted();
          const chainId = toHexChainId(effectiveActiveChainId(settings));
          await emitToTab(status.tab.tabId, { type: 'connect', chainId });
          await emitToTab(status.tab.tabId, {
            type: 'accountsChanged',
            accounts: [addr],
          });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'DISCONNECT_ACTIVE_TAB') {
      void (async () => {
        try {
          const status = await buildDappConnectionStatus();
          if (!status.tab?.origin) {
            sendResponse({ ok: false, error: status.reason ?? 'No active dapp tab' });
            return;
          }
          await disconnectOrigin(status.tab.origin);
          await emitToTab(status.tab.tabId, { type: 'disconnect' });
          await emitToTab(status.tab.tabId, { type: 'accountsChanged', accounts: [] });
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return true;
    }

    if (message.type === 'GET_SESSION') {
      void (async () => {
        try {
          const pk = await sessionPrivateKey();
          if (pk) {
            sendResponse({ ok: true, privateKeyHex: pk });
          } else {
            sendResponse({ ok: false });
          }
        } catch {
          sendResponse({ ok: false });
        }
      })();
      return true;
    }

    if (message.type === 'SET_SESSION' && typeof message.privateKeyHex === 'string') {
      if (!isValidPkHex(message.privateKeyHex)) {
        sendResponse({ ok: false, error: 'invalid key' });
        return;
      }
      memoryPk = message.privateKeyHex;
      void chrome.storage.session.set({ [SESSION_KEY]: memoryPk });
      void chrome.storage.session.remove([...LEGACY_SESSION_KEYS, ...LEGACY_ACTIVITY_KEYS]);
      void touchActivity();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'CLEAR_SESSION') {
      memoryPk = null;
      void chrome.storage.session.remove([
        SESSION_KEY,
        ...LEGACY_SESSION_KEYS,
        ACTIVITY_KEY,
        ...LEGACY_ACTIVITY_KEYS,
      ]);
      sendResponse({ ok: true });
    }
  },
);
