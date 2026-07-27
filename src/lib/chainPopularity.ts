import type { ExtendedChain } from '@lifi/types';
import defillamaDexRanks from './defillamaChainDexRank.generated.json';

/**
 * Backup for `rankByChainId` when the generated file is empty, corrupt, or a fetch script
 * run failed (Llama down / bad JSON). Mirrors last known good snapshot — refresh together
 * with `npm run update-chain-dex-ranks` when you change the committed JSON.
 */
const DEFAULT_RANK_BY_CHAIN_ID: Readonly<Record<string, number>> = {
  '1': 0,
  '10': 7,
  '19': 63,
  '25': 25,
  '30': 31,
  '40': 64,
  '56': 2,
  '82': 73,
  '100': 12,
  '108': 65,
  '122': 76,
  '130': 11,
  '137': 4,
  '143': 6,
  '146': 24,
  '169': 60,
  '173': 15,
  '199': 79,
  '204': 40,
  '239': 70,
  '246': 68,
  '250': 36,
  '252': 38,
  '288': 53,
  '295': 18,
  '314': 34,
  '324': 30,
  '360': 74,
  '388': 62,
  '592': 78,
  '690': 75,
  '747': 29,
  '988': 37,
  '1088': 41,
  '1101': 67,
  '1130': 69,
  '1135': 51,
  '1231': 66,
  '1284': 46,
  '1285': 57,
  '1625': 59,
  '1868': 19,
  '1923': 71,
  '2020': 27,
  '2345': 42,
  '2741': 17,
  '3338': 47,
  '4114': 20,
  '4217': 43,
  '4326': 8,
  '5000': 9,
  '5031': 52,
  '6900': 44,
  '8217': 35,
  '8453': 1,
  '8822': 32,
  '9745': 21,
  '10088': 45,
  '33139': 33,
  '34443': 55,
  '38833': 48,
  '42161': 3,
  '42170': 77,
  '42220': 16,
  '42420': 61,
  '43111': 39,
  '43114': 5,
  '50104': 82,
  '57073': 14,
  '59144': 23,
  '60808': 56,
  '80094': 22,
  '81457': 49,
  '97477': 26,
  '98866': 50,
  '167000': 81,
  '432204': 10,
  '534352': 28,
  '543210': 58,
  '747474': 13,
  '1313161554': 54,
  '1380012617': 80,
  '1666600000': 72,
};

function normalizeRankPayload(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== 'object') return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const chainId = Number(key);
    const rank = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(chainId) || !Number.isFinite(rank)) continue;
    out[String(chainId)] = rank;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function resolvedRankTable(): Readonly<Record<string, number>> {
  const fromFile = normalizeRankPayload(
    (defillamaDexRanks as { rankByChainId?: unknown }).rankByChainId,
  );
  return fromFile ?? DEFAULT_RANK_BY_CHAIN_ID;
}

const RANK_BY_CHAIN_ID = resolvedRankTable();

/**
 * DefiLlama 24h DEX volume ranks (canonical order = ascending rank index).
 */
function snapshotDexVolumeChainOrder(): number[] {
  return Object.entries(RANK_BY_CHAIN_ID)
    .map(([chainId, rank]) => [Number(chainId), rank] as const)
    .sort(([, ra], [, rb]) => ra - rb)
    .map(([chainId]) => chainId);
}

/**
 * Manual tail: LiFi EVM deployments often missing from DefiLlama’s slotted `breakdown24h`.
 * Listed after snapshot order; tweak when you spot gaps.
 */
const CHAIN_TAIL_FALLBACK: readonly number[] = [7777777];

/** Stable ordering for comparisons when Dex snapshot has no row (stale/offline bundles). */
const CHAIN_FALLBACK_ORDER: readonly number[] = dedupePreserveOrder([
  ...snapshotDexVolumeChainOrder(),
  ...CHAIN_TAIL_FALLBACK,
]);

function dedupePreserveOrder(ids: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

const DEX_VOLUME_RANK = new Map<number, number>(
  Object.entries(RANK_BY_CHAIN_ID).map(([k, v]) => [Number(k), v]),
);

const FALLBACK_RANK = new Map<number, number>(
  CHAIN_FALLBACK_ORDER.map((id, rank) => [id, rank]),
);

function chainName(chainById: ReadonlyMap<number, ExtendedChain>, id: number): string {
  return chainById.get(id)?.name ?? `Chain ${id}`;
}

function compareChainIdsByPopularity(
  a: number,
  b: number,
  chainById: ReadonlyMap<number, ExtendedChain>,
): number {
  const da = DEX_VOLUME_RANK.has(a);
  const db = DEX_VOLUME_RANK.has(b);
  if (da && db) {
    const ra = DEX_VOLUME_RANK.get(a)!;
    const rb = DEX_VOLUME_RANK.get(b)!;
    if (ra !== rb) return ra - rb;
  } else if (da !== db) {
    return da ? -1 : 1;
  } else {
    const fa = FALLBACK_RANK.get(a) ?? 9999;
    const fb = FALLBACK_RANK.get(b) ?? 9999;
    if (fa !== fb) return fa - fb;
  }

  return chainName(chainById, a).localeCompare(chainName(chainById, b));
}

/**
 * Optional “wallet has tokens here” first — source network picker only.
 */
export function sortEvmChainIds(
  ids: number[],
  chains: ExtendedChain[],
  opts?: { balanceFirst?: boolean; balancesByChain?: Record<number, unknown[]> | null },
): number[] {
  const chainById = new Map(chains.map(c => [c.id, c] as const));
  return [...new Set(ids)].sort((a, b) => {
    if (opts?.balanceFirst && opts.balancesByChain) {
      const ha = (opts.balancesByChain[a]?.length ?? 0) > 0;
      const hb = (opts.balancesByChain[b]?.length ?? 0) > 0;
      if (ha !== hb) return Number(hb) - Number(ha);
    }
    return compareChainIdsByPopularity(a, b, chainById);
  });
}

export function sortExtendedChains(
  chains: ExtendedChain[],
  opts?: { balanceFirst?: boolean; balancesByChain?: Record<number, unknown[]> | null },
): ExtendedChain[] {
  if (!chains.length) return chains;
  const byId = new Map(chains.map(c => [c.id, c] as const));
  const ids = sortEvmChainIds(
    chains.map(c => c.id),
    chains,
    opts,
  );
  return ids.map(id => byId.get(id)!);
}
