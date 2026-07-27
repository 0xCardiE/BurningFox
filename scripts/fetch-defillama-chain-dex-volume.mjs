/**
 * Downloads DefiLlama DEX “24h volume” aggregates per chain, maps them to numeric
 * `chainId` values via https://api.llama.fi/chains, and writes a small JSON
 * rank file for the UI. Intended to run manually or on a ~daily schedule.
 *
 * Data: GET https://api.llama.fi/overview/dexs — sum each protocol’s
 * `breakdown24h` values per chain slug (same basis as defillama.com/chains DEX view).
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../src/lib/defillamaChainDexRank.generated.json');

/** DefiLlama `breakdown24h` keys that don’t match our default slug guesses. */
const NAME_TO_LL_SLUG = {
  Binance: 'bsc',
  Avalanche: 'avax',
  'zkSync Era': 'era',
};

/** Some entries use non-numeric IDs in the API; skip those. */
function numericChainId(id) {
  if (id === null || id === undefined) return null;
  const n = Number(id);
  return Number.isFinite(n) ? n : null;
}

function slugCandidates(name) {
  const n = String(name ?? '')
    .trim()
    .toLowerCase();
  const underscored = n.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const compact = underscored.replace(/_/g, '');
  return [...new Set([NAME_TO_LL_SLUG[name], underscored, compact].filter(Boolean))];
}

function resolveSlug(name, volumeBySlug) {
  const direct = NAME_TO_LL_SLUG[name];
  if (direct && volumeBySlug.has(direct)) return direct;
  for (const c of slugCandidates(name)) {
    if (volumeBySlug.has(c)) return c;
  }
  return null;
}

async function main() {
  const [dexRes, chainsRes] = await Promise.all([
    fetch('https://api.llama.fi/overview/dexs'),
    fetch('https://api.llama.fi/chains'),
  ]);

  if (!dexRes.ok) throw new Error(`DefiLlama dex overview HTTP ${dexRes.status}`);
  if (!chainsRes.ok) throw new Error(`DefiLlama chains HTTP ${chainsRes.status}`);

  /** @type {{ protocols?: Array<{ breakdown24h?: Record<string, Record<string, number>> }> }} */
  const dexJson = await dexRes.json();
  /** @type {Array<{ name?: string; chainId?: unknown }>} */
  const chains = await chainsRes.json();

  const agg = new Map();
  for (const p of dexJson.protocols ?? []) {
    const bd = p.breakdown24h;
    if (!bd || typeof bd !== 'object') continue;
    for (const [slug, dexes] of Object.entries(bd)) {
      if (!dexes || typeof dexes !== 'object') continue;
      for (const v of Object.values(dexes)) {
        const n = typeof v === 'number' ? v : 0;
        agg.set(slug, (agg.get(slug) ?? 0) + n);
      }
    }
  }

  const rows = [];
  for (const ch of chains) {
    const id = numericChainId(ch.chainId);
    if (id === null) continue;
    const slug = resolveSlug(ch.name ?? '', agg);
    if (!slug) continue;
    const vol = agg.get(slug) ?? 0;
    if (vol <= 0) continue;
    rows.push({ chainId: id, volume24h: vol, llamaSlug: slug, name: ch.name });
  }

  rows.sort((a, b) => b.volume24h - a.volume24h);
  const rankByChainId = Object.fromEntries(rows.map((r, i) => [String(r.chainId), i]));

  const payload = {
    source: 'https://api.llama.fi/overview/dexs (aggregated breakdown24h) + https://api.llama.fi/chains',
    generatedAt: new Date().toISOString(),
    rankByChainId,
  };

  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${rows.length} ranked chains -> ${OUT}`);
  console.log(
    'If rankings changed materially, copy rankByChainId into DEFAULT_RANK_BY_CHAIN_ID (chainPopularity.ts).',
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
