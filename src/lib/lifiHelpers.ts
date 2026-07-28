import { getAddress } from 'viem';

export const ZERO = '0x0000000000000000000000000000000000000000';
export const ETH_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export function isNativeToken(addr: string): boolean {
  const a = addr.toLowerCase();
  return a === ZERO || a === ETH_PLACEHOLDER;
}

export function tokenKeyForQuote(addr: string): string {
  try {
    return isNativeToken(addr) ? addr : getAddress(addr);
  } catch {
    return addr;
  }
}

export function fmtNum(n: number, d = 6): string {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1 || n === 0) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumSignificantDigits: d });
}

/** @returns true when string is a plausible positive decimal amount */
export function parseHumanAmount(
  s: string,
): { ok: true; raw: string } | { ok: false; reason: string } {
  const t = s.trim().replace(/\s/g, '');
  if (!t) return { ok: false, reason: 'Enter an amount.' };
  if (!/^\d*(\.\d+)?$/.test(t))
    return { ok: false, reason: 'Use digits and at most one decimal point.' };
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0)
    return { ok: false, reason: 'Amount must be greater than zero.' };
  return { ok: true, raw: t };
}

export function routeProviderLabel(tool: string, toolName?: string): string {
  const n = (toolName ?? tool).trim();
  if (!n) return 'LiFi';
  if (/relay/i.test(n) || tool.toLowerCase() === 'relay') return 'Relay';
  return n;
}
