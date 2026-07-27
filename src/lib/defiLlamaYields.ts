import type { VaultOpportunity } from './vaultOpportunity';

/** Raw row from `https://yields.llama.fi/pools`. */
export type LlamaYieldPool = {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase?: number;
  apyReward?: number;
  rewardTokens?: string[];
  underlyingTokens?: string[];
  poolMeta?: string | null;
  stablecoin?: boolean;
  exposure?: string;
  url?: string;
};

type PoolsResponse = { status: string; data: LlamaYieldPool[] };

const YIELDS_POOLS = 'https://yields.llama.fi/pools';
const PROTOCOLS_API = 'https://api.llama.fi/protocols';
const ICON_SLUG = (slug: string) => `https://icons.llama.fi/${encodeURIComponent(slug)}.png`;
const DEFILLAMA_PROTOCOL = (slug: string) =>
  `https://defillama.com/protocol/${encodeURIComponent(slug)}`;

const ZERO = '0x0000000000000000000000000000000000000000';

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map(p => p.slice(0, 1).toUpperCase() + p.slice(1))
    .join(' ');
}

function firstAssetAddress(pool: LlamaYieldPool): string {
  const tok = pool.underlyingTokens?.find(
    t => typeof t === 'string' && /^0x[a-fA-F0-9]{40}$/.test(t),
  );
  return tok ? tok : ZERO;
}

/**
 * Map a DefiLlama pool row into our internal opportunity shape.
 * `vaultAddress` is often unknown at discovery time; execution will use protocol-specific
 * metadata or a transaction-prep API later.
 */
export function llamaPoolToVaultOpportunity(pool: LlamaYieldPool): VaultOpportunity {
  const slug = pool.project;
  const assetAddr = firstAssetAddress(pool);
  const id = `${pool.chain}::${slug}::${pool.pool}`;
  return {
    id,
    projectSlug: slug,
    protocol: titleCaseSlug(slug),
    protocolLogo: ICON_SLUG(slug),
    chain: pool.chain,
    asset: pool.symbol,
    assetAddress: assetAddr,
    vaultAddress: '',
    apy: pool.apy,
    apyBase: pool.apyBase,
    apyReward: pool.apyReward ?? undefined,
    tvlUsd: pool.tvlUsd,
    depositUrl: pool.url?.trim?.() || DEFILLAMA_PROTOCOL(slug),
    adapterType: 'defillama-discovery',
  };
}

type LlamaProtocolRow = { slug?: string; category?: string };

/** Map yields `project` slug → DefiLlama protocol category (when listed). */
export async function fetchLlamaProtocolCategoryMap(signal?: AbortSignal): Promise<Map<string, string>> {
  const res = await fetch(PROTOCOLS_API, { signal });
  if (!res.ok) throw new Error(`Protocols HTTP ${res.status}`);
  const rows = (await res.json()) as LlamaProtocolRow[];
  const map = new Map<string, string>();
  if (!Array.isArray(rows)) return map;
  for (const p of rows) {
    const slug = typeof p.slug === 'string' ? p.slug.trim() : '';
    const cat = typeof p.category === 'string' ? p.category.trim() : '';
    if (slug && cat) map.set(slug, cat);
  }
  return map;
}

function enrichWithProtocolCategories(
  rows: VaultOpportunity[],
  slugToCategory: Map<string, string>,
): VaultOpportunity[] {
  return rows.map(v => {
    const protocolCategory = slugToCategory.get(v.projectSlug);
    return protocolCategory ? { ...v, protocolCategory } : v;
  });
}

export type LlamaYieldDataset = {
  pools: LlamaYieldPool[];
  categoryMap: Map<string, string>;
};

/** Full yields payload + protocol categories for client-side filtering. */
export async function fetchLlamaYieldDataset(signal?: AbortSignal): Promise<LlamaYieldDataset> {
  const pools = await fetchLlamaYieldPools(signal);
  let categoryMap = new Map<string, string>();
  try {
    categoryMap = await fetchLlamaProtocolCategoryMap(signal);
  } catch {
    /* optional enrichment */
  }
  return { pools, categoryMap };
}

export type YieldVaultRankOpts = {
  maxRows: number;
  /** Exact DefiLlama chain name; omit for all chains. */
  chain?: string;
  /** Exact protocol category label from DefiLlama; omit for all types. */
  category?: string;
  /** Only pools with TVL ≤ this USD amount; omit for no cap. */
  maxTvlUsd?: number;
};

/** Filter, sort by APY, cap rows, attach protocol categories. */
export function rankYieldPoolsToVaults(
  pools: LlamaYieldPool[],
  categoryMap: Map<string, string>,
  opts: YieldVaultRankOpts,
): VaultOpportunity[] {
  const chain = opts.chain?.trim();
  const category = opts.category?.trim();

  const filtered = pools.filter(p => {
    if (typeof p.apy !== 'number' || !Number.isFinite(p.apy) || p.apy <= 0) return false;
    if (typeof p.tvlUsd !== 'number' || !Number.isFinite(p.tvlUsd) || p.tvlUsd <= 0) return false;
    if (opts.maxTvlUsd !== undefined && p.tvlUsd > opts.maxTvlUsd) return false;
    if (chain && p.chain !== chain) return false;
    if (category) {
      const pc = categoryMap.get(p.project);
      if (pc !== category) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (b.apy !== a.apy ? b.apy - a.apy : b.tvlUsd - a.tvlUsd));
  const mapped = filtered.slice(0, opts.maxRows).map(llamaPoolToVaultOpportunity);
  return enrichWithProtocolCategories(mapped, categoryMap);
}

export function sortedUniqueChains(pools: LlamaYieldPool[]): string[] {
  const set = new Set<string>();
  for (const p of pools) {
    if (typeof p.chain === 'string' && p.chain.trim()) set.add(p.chain);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function sortedCategoriesPresentInPools(
  pools: LlamaYieldPool[],
  categoryMap: Map<string, string>,
): string[] {
  const set = new Set<string>();
  for (const p of pools) {
    const c = categoryMap.get(p.project);
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Fetch pools + protocol categories; ranked rows include `protocolCategory` when DefiLlama lists one. */
export async function fetchRankedVaultOpportunities(
  opts: YieldVaultRankOpts,
  signal?: AbortSignal,
): Promise<VaultOpportunity[]> {
  const { pools, categoryMap } = await fetchLlamaYieldDataset(signal);
  return rankYieldPoolsToVaults(pools, categoryMap, opts);
}

export async function fetchLlamaYieldPools(signal?: AbortSignal): Promise<LlamaYieldPool[]> {
  const res = await fetch(YIELDS_POOLS, { signal });
  if (!res.ok) throw new Error(`Yields HTTP ${res.status}`);
  const body = (await res.json()) as PoolsResponse;
  if (body.status !== 'success' || !Array.isArray(body.data))
    throw new Error('Unexpected yields response shape');
  return body.data;
}
