import { formatUnits } from 'viem';
import { getAddress } from 'viem';
import { getWalletBalances } from '@lifi/sdk';
import { snapshotHeldTokensOnChain, type OnChainBalanceProbe } from './ethereum';
import { summarizeApiError } from './errors';

export type WalletBalEntry = {
  address: string;
  symbol: string;
  decimals: number;
  amount: string;
  chainId: number;
  name: string;
  priceUSD?: string;
  logoURI?: string;
};

const RPC_BALANCE_OVERRIDE_TTL_MS = 120_000;
const rpcFresh = new Map<number, { at: number; rows: WalletBalEntry[] }>();

export function fmtTokenAmount(entry: WalletBalEntry): string {
  try {
    const n = Number(formatUnits(BigInt(entry.amount || '0'), entry.decimals));
    if (!Number.isFinite(n)) return '—';
    if (n >= 1 || n === 0) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return n.toLocaleString(undefined, { maximumSignificantDigits: 6 });
  } catch {
    return '—';
  }
}

export function fmtUsdValue(entry: WalletBalEntry): string | null {
  try {
    const n = Number(formatUnits(BigInt(entry.amount || '0'), entry.decimals));
    const usd = n * Number(entry.priceUSD || 0);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    return usd.toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  } catch {
    return null;
  }
}

function balEntryToProbe(b: WalletBalEntry): OnChainBalanceProbe {
  return {
    address: b.address,
    decimals: b.decimals,
    symbol: b.symbol,
    name: b.name,
    logoURI: b.logoURI,
    priceUSD: b.priceUSD,
  };
}

function compareByUsd(a: WalletBalEntry, b: WalletBalEntry): number {
  const ua =
    Number(formatUnits(BigInt(a.amount || '0'), a.decimals)) * Number(a.priceUSD || 0);
  const ub =
    Number(formatUnits(BigInt(b.amount || '0'), b.decimals)) * Number(b.priceUSD || 0);
  if (Number.isFinite(ua) && Number.isFinite(ub) && ua !== ub) {
    return ub - ua;
  }
  const ba = BigInt(a.amount || '0');
  const bb = BigInt(b.amount || '0');
  if (ba !== bb) return ba > bb ? -1 : 1;
  return a.symbol.localeCompare(b.symbol);
}

/** LiFi balances merged with optional on-chain RPC refresh for one chain. */
export async function loadWalletBalancesForChain(
  address: string,
  chainId: number,
  options?: { refreshRpc?: boolean },
): Promise<{ rows: WalletBalEntry[]; error: string | null }> {
  const holder = getAddress(address);
  try {
    const raw = await getWalletBalances(holder);
    const all: WalletBalEntry[] = [];
    for (const [k, list] of Object.entries(raw ?? {})) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      for (const t of list as WalletBalEntry[]) {
        try {
          if (BigInt(t.amount || '0') <= 0n) continue;
        } catch {
          continue;
        }
        all.push({ ...t, chainId: id });
      }
    }

    let chainRows = all.filter(r => r.chainId === chainId);

    const now = Date.now();
    for (const [cid, pack] of [...rpcFresh.entries()]) {
      if (now - pack.at >= RPC_BALANCE_OVERRIDE_TTL_MS) rpcFresh.delete(cid);
    }

    const cached = rpcFresh.get(chainId);
    if (cached && now - cached.at < RPC_BALANCE_OVERRIDE_TTL_MS) {
      chainRows = cached.rows;
    } else if (options?.refreshRpc && chainRows.length > 0) {
      const probes = chainRows.map(balEntryToProbe);
      const fresh = await snapshotHeldTokensOnChain(chainId, holder, probes);
      const rows = fresh.map(r => ({ ...r, chainId }));
      rpcFresh.set(chainId, { at: now, rows });
      chainRows = rows;
    }

    chainRows.sort(compareByUsd);
    return { rows: chainRows, error: null };
  } catch (e) {
    return { rows: [], error: summarizeApiError(e) };
  }
}

export function invalidateRpcBalanceCache(chainId?: number): void {
  if (chainId == null) {
    rpcFresh.clear();
    return;
  }
  rpcFresh.delete(chainId);
}
