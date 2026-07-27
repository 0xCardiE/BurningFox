import type { ExtendedChain } from '@lifi/types';

function metamaskExplorerBase(chain?: ExtendedChain): string | undefined {
  const c = chain as { metamask?: { blockExplorerUrls?: string[] } } | undefined;
  const u = c?.metamask?.blockExplorerUrls?.[0];
  return u ? u.replace(/\/$/, '') : undefined;
}

/** When LiFi omits explorer metadata, common EVM explorers by chain id. */
const FALLBACK_EXPLORER_BASE: Record<number, string> = {
  1: 'https://etherscan.io',
  10: 'https://optimistic.etherscan.io',
  56: 'https://bscscan.com',
  100: 'https://gnosisscan.io',
  137: 'https://polygonscan.com',
  324: 'https://explorer.zksync.io',
  8453: 'https://basescan.org',
  42161: 'https://arbiscan.io',
  43114: 'https://snowscan.io',
};

/** Block explorer origin for a chain (no trailing slash). */
export function explorerBaseUrl(chainId: number, lifiChain?: ExtendedChain): string | undefined {
  return metamaskExplorerBase(lifiChain) ?? FALLBACK_EXPLORER_BASE[chainId];
}

/** Full URL to a transaction on a chain’s default explorer. */
export function transactionExplorerUrl(
  chainId: number,
  txHash: string,
  lifiChain?: ExtendedChain,
): string | undefined {
  const base = explorerBaseUrl(chainId, lifiChain);
  if (!base) return undefined;
  const h = txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(h)) return undefined;
  return `${base}/tx/${h}`;
}
