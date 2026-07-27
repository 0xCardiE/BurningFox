import type { ExtendedChain } from '@lifi/types';
import { CHAIN_CATALOG, MAX_RPC_OPTIONS } from './chainCatalog';
import { CHAIN_RPC_FALLBACK } from './constants';

const catalogRpcs: Record<number, string[]> = Object.fromEntries(
  CHAIN_CATALOG.map(c => [c.chainId, [...c.rpcUrls]]),
);

const extraRpcsByChainId: Record<number, string[]> = {};

/** User-selected RPC URL per chain (persisted). */
let preferredRpcByChainId: Record<number, string> = {};
let customRpcByChainId: Record<number, string[]> = {};

export function setPreferredRpcMap(map: Record<number, string>): void {
  preferredRpcByChainId = { ...map };
}

export function setCustomRpcMap(map: Record<number, string[]>): void {
  customRpcByChainId = { ...map };
}

export function preferredRpcFor(chainId: number): string | undefined {
  const url = preferredRpcByChainId[chainId]?.trim();
  return url || undefined;
}

export function setPreferredRpc(chainId: number, url: string | undefined): void {
  if (!url?.trim()) {
    const next = { ...preferredRpcByChainId };
    delete next[chainId];
    preferredRpcByChainId = next;
    return;
  }
  preferredRpcByChainId = { ...preferredRpcByChainId, [chainId]: url.trim() };
}

/**
 * Prefer hardcoded fallback RPCs, then URLs from LiFi chain metadata so new
 * chains from quotes can still be broadcast without maintaining a giant map by hand.
 */
export function mergeLifiChainRpcs(chains: ExtendedChain[]): void {
  for (const chain of chains) {
    const urls =
      chain.chainType !== 'EVM'
        ? undefined
        : chain.metamask?.rpcUrls?.filter((u): u is string => Boolean(u));
    if (!urls?.length) continue;
    extraRpcsByChainId[chain.id] ??= [];
    const cur = extraRpcsByChainId[chain.id]!;
    for (const url of urls) {
      if (!cur.includes(url)) cur.push(url);
    }
  }
}

export function rpcUrlsFor(chainId: number): string[] {
  const preferred = preferredRpcFor(chainId);
  const fb = CHAIN_RPC_FALLBACK[chainId] ?? [];
  const catalog = catalogRpcs[chainId] ?? [];
  const custom = customRpcByChainId[chainId] ?? [];
  const extra = extraRpcsByChainId[chainId] ?? [];
  const merged: string[] = [];
  const seen = new Set<string>();
  const ordered = preferred
    ? [preferred, ...custom, ...catalog, ...fb, ...extra]
    : [...custom, ...catalog, ...fb, ...extra];
  for (const u of ordered) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    merged.push(t);
  }
  return merged;
}

/** All known RPC endpoints for a chain (for dropdown UI). Capped at {@link MAX_RPC_OPTIONS}. */
export function allRpcOptionsFor(chainId: number, max = MAX_RPC_OPTIONS): string[] {
  return rpcUrlsFor(chainId).slice(0, max);
}
