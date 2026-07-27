import type { EncryptedVault } from './vault';
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_SLIPPAGE_PERCENT,
} from './constants';
import { setPreferredRpcMap, setCustomRpcMap } from './chainRpcRegistry';

export type ToolbarOpenMode = 'popup' | 'side_panel';

export interface AppSettings {
  /** Relay / LiFi swap slippage tolerance in percent (e.g. 5 = 5%). */
  slippagePercent?: number;
  /** Lock after this many minutes with no interaction (0 = off). */
  autoLockMinutes?: number;
  /** Whether the toolbar icon opens the classic popup or the browser side panel. */
  toolbarOpenMode?: ToolbarOpenMode;
  /** Active EVM chain for dapp provider + default network UI. */
  activeChainId?: number;
  /** Preferred RPC URL per chain id (string keys in storage). */
  preferredRpcByChain?: Record<string, string>;
  /** Custom RPC URLs appended per chain id. */
  customRpcByChain?: Record<string, string[]>;
  /** When true, inject as window.ethereum (MetaMask drop-in). When false, use window.burningFox. */
  replaceMetaMask?: boolean;
}

export interface PersistedState {
  vault: EncryptedVault | null;
  settings: AppSettings;
}

/** Local storage key for the persisted vault + settings bundle. */
export const WALLET_PERSIST_KEY = 'burning_fox_wallet_v1' as const;
const LEGACY_KEYS = ['jumpa_wallet_v1', 'beewallet_v1'] as const;
const KEY = WALLET_PERSIST_KEY;

const EMPTY: PersistedState = {
  vault: null,
  settings: {},
};

function area(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

function normalizeSlippagePercent(
  v: number | undefined | null,
): number | undefined {
  if (v == null || !Number.isFinite(v)) return undefined;
  const clamped = Math.min(50, Math.max(0.01, Math.round(v * 1000) / 1000));
  return clamped;
}

function normalizePreferredRpcMap(
  raw: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeCustomRpcMap(
  raw: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const urls = list.filter(u => typeof u === 'string' && u.trim()).map(u => u.trim());
    if (urls.length) out[k] = urls;
  }
  return Object.keys(out).length ? out : undefined;
}

function applyRpcPreferences(settings: AppSettings): void {
  const preferred: Record<number, string> = {};
  const custom: Record<number, string[]> = {};
  for (const [k, v] of Object.entries(settings.preferredRpcByChain ?? {})) {
    const id = Number(k);
    if (Number.isFinite(id) && v) preferred[id] = v;
  }
  for (const [k, list] of Object.entries(settings.customRpcByChain ?? {})) {
    const id = Number(k);
    if (Number.isFinite(id) && list?.length) custom[id] = list;
  }
  setPreferredRpcMap(preferred);
  setCustomRpcMap(custom);
}

export async function loadPersisted(): Promise<PersistedState> {
  return new Promise((resolve, reject) => {
    area().get([KEY, ...LEGACY_KEYS], (r) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const row =
        (r[KEY] as PersistedState | undefined) ??
        (LEGACY_KEYS.map(k => r[k]).find(Boolean) as PersistedState | undefined);
      if (!row) {
        resolve({ ...EMPTY });
        return;
      }
      const tm = normalizeToolbarOpenMode(row.settings?.toolbarOpenMode);
      const next: PersistedState = {
        vault: row.vault ?? null,
        settings: {
          slippagePercent: normalizeSlippagePercent(row.settings?.slippagePercent),
          autoLockMinutes: normalizeAutoLockMinutes(row.settings?.autoLockMinutes),
          activeChainId: normalizeChainId(row.settings?.activeChainId),
          preferredRpcByChain: normalizePreferredRpcMap(row.settings?.preferredRpcByChain),
          customRpcByChain: normalizeCustomRpcMap(row.settings?.customRpcByChain),
          replaceMetaMask: row.settings?.replaceMetaMask !== false,
          ...(tm ? { toolbarOpenMode: tm } : {}),
        },
      };
      applyRpcPreferences(next.settings);
      if (!r[KEY]) {
        void savePersisted(next);
      }
      resolve(next);
    });
  });
}

export async function savePersisted(next: PersistedState): Promise<void> {
  return new Promise((resolve, reject) => {
    area().set({ [KEY]: next }, () => {
      const e = chrome.runtime?.lastError;
      if (e) reject(new Error(e.message));
      else {
        void chrome.storage.local.remove(LEGACY_KEYS);
        resolve();
      }
    });
  });
}

export async function setVault(vault: EncryptedVault | null): Promise<void> {
  const cur = await loadPersisted();
  await savePersisted({ ...cur, vault });
}

export async function patchSettings(patch: AppSettings): Promise<void> {
  const cur = await loadPersisted();
  const merged = { ...cur.settings, ...patch };
  applyRpcPreferences(merged);
  await savePersisted({
    ...cur,
    settings: merged,
  });
}

function normalizeChainId(v: number | undefined | null): number | undefined {
  if (v == null || !Number.isFinite(v) || v <= 0) return undefined;
  return Math.floor(v);
}

function normalizeAutoLockMinutes(
  v: number | undefined | null,
): number | undefined {
  if (v == null || !Number.isFinite(v) || v === 0) return undefined;
  const allowed = [5, 15, 30, 60];
  return allowed.includes(v) ? v : undefined;
}

function normalizeToolbarOpenMode(
  v: string | undefined | null,
): ToolbarOpenMode | undefined {
  if (v === 'side_panel' || v === 'popup') return v;
  return undefined;
}

export function effectiveSlippagePercent(settings: AppSettings): number {
  const n = normalizeSlippagePercent(settings.slippagePercent);
  return n ?? DEFAULT_SLIPPAGE_PERCENT;
}

/** LiFi `slippage` query param: `0.05` means 5%. */
export function effectiveSlippageRatio(settings: AppSettings): number {
  return effectiveSlippagePercent(settings) / 100;
}

export function parseSlippageInput(raw: string): number | null {
  const n = Number(raw.trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return normalizeSlippagePercent(n) ?? null;
}

export function effectiveAutoLockMinutes(settings: AppSettings): number {
  return normalizeAutoLockMinutes(settings.autoLockMinutes) ?? 0;
}

export function effectiveToolbarOpenMode(settings: AppSettings): ToolbarOpenMode {
  return normalizeToolbarOpenMode(settings.toolbarOpenMode) ?? 'side_panel';
}

export function effectiveActiveChainId(settings: AppSettings): number {
  return normalizeChainId(settings.activeChainId) ?? DEFAULT_CHAIN_ID;
}

export function effectiveReplaceMetaMask(settings: AppSettings): boolean {
  return settings.replaceMetaMask !== false;
}
