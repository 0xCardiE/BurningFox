import type { TxHistoryRow } from './explorerTxHistory';

const STORAGE_KEY = 'burn_box_tx_history_v1';

type StoredRow = {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  timestamp: number;
  success: boolean;
  direction: 'in' | 'out' | 'self';
};

export type TxHistoryCache = {
  pagesLoaded: number;
  hasMore: boolean;
  rows: TxHistoryRow[];
};

type PersistedBundle = Record<string, { pagesLoaded: number; hasMore: boolean; rows: StoredRow[] }>;

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function toStored(rows: TxHistoryRow[]): StoredRow[] {
  return rows.map(r => ({
    hash: r.hash,
    from: r.from,
    to: r.to,
    value: r.value.toString(),
    timestamp: r.timestamp,
    success: r.success,
    direction: r.direction,
  }));
}

function fromStored(rows: StoredRow[]): TxHistoryRow[] {
  return rows.map(r => ({
    hash: r.hash as `0x${string}`,
    from: r.from as `0x${string}`,
    to: r.to as `0x${string}` | null,
    value: BigInt(r.value),
    timestamp: r.timestamp,
    success: r.success,
    direction: r.direction,
  }));
}

function storage(): chrome.storage.LocalStorageArea {
  return chrome.storage.local;
}

async function readAll(): Promise<PersistedBundle> {
  return new Promise((resolve, reject) => {
    storage().get([STORAGE_KEY], r => {
      const err = chrome.runtime?.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      const raw = r[STORAGE_KEY];
      resolve(raw && typeof raw === 'object' ? (raw as PersistedBundle) : {});
    });
  });
}

export async function loadTxHistoryCache(
  chainId: number,
  address: string,
): Promise<TxHistoryCache | null> {
  const all = await readAll();
  const entry = all[cacheKey(chainId, address)];
  if (!entry) return null;
  return {
    pagesLoaded: entry.pagesLoaded,
    hasMore: entry.hasMore,
    rows: fromStored(entry.rows),
  };
}

export async function saveTxHistoryCache(
  chainId: number,
  address: string,
  cache: TxHistoryCache,
): Promise<void> {
  const all = await readAll();
  all[cacheKey(chainId, address)] = {
    pagesLoaded: cache.pagesLoaded,
    hasMore: cache.hasMore,
    rows: toStored(cache.rows),
  };
  return new Promise((resolve, reject) => {
    storage().set({ [STORAGE_KEY]: all }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export async function clearTxHistoryCache(chainId: number, address: string): Promise<void> {
  const all = await readAll();
  delete all[cacheKey(chainId, address)];
  return new Promise((resolve, reject) => {
    storage().set({ [STORAGE_KEY]: all }, () => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

export function mergeTxRows(existing: TxHistoryRow[], next: TxHistoryRow[]): TxHistoryRow[] {
  const seen = new Set(existing.map(r => r.hash));
  const merged = [...existing];
  for (const row of next) {
    if (seen.has(row.hash)) continue;
    seen.add(row.hash);
    merged.push(row);
  }
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return merged;
}
