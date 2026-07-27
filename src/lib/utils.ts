import {
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toHex,
} from 'viem';

export function readBatchId(nonce: `0x${string}`, sender: string): string {
  const encoded = encodeAbiParameters(
    parseAbiParameters(['address', 'bytes32']),
    [sender as `0x${string}`, nonce],
  );
  return keccak256(encoded).slice(2);
}

export function generateNonce(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function formatDate(timestampSec: number): string {
  if (!timestampSec || Number.isNaN(timestampSec)) return '—';
  return new Date(timestampSec * 1000).toISOString().slice(0, 10);
}

export function formatDateMs(ms: number): string {
  if (!ms || Number.isNaN(ms)) return '—';
  return new Date(ms).toISOString().slice(0, 10);
}

export function formatTTL(ttlSeconds: number): string {
  if (ttlSeconds < 0) {
    const expired = Math.abs(ttlSeconds);
    const days = Math.floor(expired / 86400);
    if (days >= 1) return `Expired ${days}d ago`;
    const hours = Math.floor(expired / 3600);
    if (hours >= 1) return `Expired ${hours}h ago`;
    return 'Expired';
  }
  const days = Math.floor(ttlSeconds / 86400);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'} left`;
  const hours = Math.floor(ttlSeconds / 3600);
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.floor(ttlSeconds / 60);
  return `${minutes}m left`;
}

export function getStampUsagePercent(
  utilization: number,
  depth: number,
  bucketDepth = 16,
): number {
  if (!Number.isFinite(utilization) || !Number.isFinite(depth)) return 0;
  return (utilization / Math.pow(2, depth - bucketDepth)) * 100;
}

export function shortHash(s: string, head = 6, tail = 4): string {
  if (!s) return '';
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function ensureHexPrefix(s: string): `0x${string}` {
  return (s.startsWith('0x') ? s : `0x${s}`) as `0x${string}`;
}

export function describeError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const data = (err as { data?: { message?: string } }).data;
    if (data?.message) return String(data.message);
    return err.message || err.toString();
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
