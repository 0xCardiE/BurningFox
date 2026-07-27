/**
 * Content script (isolated world) — bridges page provider ↔ extension background.
 *
 * After the extension reloads/updates, scripts already on open tabs keep running
 * but chrome.runtime becomes dead ("Extension context invalidated"). Guard every
 * chrome API call so we return a clean RPC error instead of an uncaught throw —
 * and so a freshly reinjected content script can take over without a page refresh.
 */
import {
  PROVIDER_CHANNEL,
  type ProviderRequest,
  type ProviderResponse,
} from '../provider/types';

const CONTEXT_DEAD_MSG =
  'BurnBox was updated or reloaded. Refresh this page to reconnect.';

let cachedReplaceMetaMask = true;
let contextDead = false;

function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function markContextDead(): void {
  contextDead = true;
}

function deadResponse(id: string): ProviderResponse {
  return {
    id,
    ok: false,
    error: { code: 4900, message: CONTEXT_DEAD_MSG },
  };
}

async function sendToBackground<T>(message: unknown): Promise<T> {
  if (contextDead || !isExtensionContextValid()) {
    markContextDead();
    throw new Error(CONTEXT_DEAD_MSG);
  }
  try {
    return (await chrome.runtime.sendMessage(message)) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Extension context invalidated') || !isExtensionContextValid()) {
      markContextDead();
      throw new Error(CONTEXT_DEAD_MSG);
    }
    throw err;
  }
}

async function loadInjectConfig(): Promise<{ replaceMetaMask: boolean }> {
  try {
    const res = await sendToBackground<{
      ok?: boolean;
      replaceMetaMask?: boolean;
    }>({ type: 'PROVIDER_GET_CONFIG' });
    cachedReplaceMetaMask = res?.replaceMetaMask !== false;
  } catch {
    /* keep previous / default when background is unavailable */
  }
  return { replaceMetaMask: cachedReplaceMetaMask };
}

void loadInjectConfig();

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.channel !== PROVIDER_CHANNEL) return;

  if (data.target === 'content' && data.type === 'init') {
    if (contextDead || !isExtensionContextValid()) {
      markContextDead();
      return;
    }
    void loadInjectConfig().then(config => {
      window.postMessage(
        { channel: PROVIDER_CHANNEL, type: 'init-config', config },
        '*',
      );
    });
    return;
  }

  if (data.target !== 'content' || data.type !== 'request') return;
  const request = data.request as ProviderRequest;

  // Orphaned after extension reload — ignore so a reinjected script can answer.
  if (contextDead || !isExtensionContextValid()) {
    markContextDead();
    return;
  }

  void sendToBackground<ProviderResponse>({
    type: 'PROVIDER_RPC',
    request,
    origin: window.location.origin,
  })
    .then(response => {
      window.postMessage(
        { channel: PROVIDER_CHANNEL, target: 'inpage', type: 'response', response },
        '*',
      );
    })
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const response: ProviderResponse =
        contextDead || msg.includes('Extension context invalidated')
          ? deadResponse(request.id)
          : {
              id: request.id,
              ok: false,
              error: { code: 4900, message: msg },
            };
      window.postMessage(
        { channel: PROVIDER_CHANNEL, target: 'inpage', type: 'response', response },
        '*',
      );
    });
});

try {
  chrome.runtime.onMessage.addListener(msg => {
    if (contextDead || !isExtensionContextValid()) {
      markContextDead();
      return;
    }
    if (!msg || msg.type !== 'PROVIDER_EMIT') return;
    window.postMessage(
      {
        channel: PROVIDER_CHANNEL,
        target: 'inpage',
        type: 'event',
        event: msg.event,
      },
      '*',
    );
  });
} catch {
  markContextDead();
}

/** Keep bridge alive if the service worker slept. */
void sendToBackground({ type: 'PING' }).catch(() => undefined);
