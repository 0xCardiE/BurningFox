import { createAndStartJob } from '../search/runner.js';
import { hasXSession } from '../search/x.js';
import { loadData } from '../storage.js';
import type { Source } from '../types.js';

function parseArgs(argv: string[]) {
  const out: {
    sources: Source[];
    timeRange: 'year' | 'month' | 'week';
    queryIds?: string[];
  } = {
    sources: ['reddit', 'google'],
    timeRange: 'year',
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sources' || a === '-s') {
      out.sources = argv[++i].split(',').map((s) => s.trim()) as Source[];
    } else if (a === '--time' || a === '-t') {
      out.timeRange = argv[++i] as typeof out.timeRange;
    } else if (a === '--queries' || a === '-q') {
      out.queryIds = argv[++i].split(',').map((s) => s.trim());
    } else if (a === '--help' || a === '-h') {
      console.log(`Usage: npm run search -- [options]

Options:
  --sources, -s   reddit,google,x   (default: reddit,google)
  --time, -t      year | month | week (default: year)
  --queries, -q   comma-separated query ids (default: all enabled)

Examples:
  npm run search
  npm run search -- --sources reddit,x --time month
  npm run search -- -s reddit -q reddit-metamask,reddit-ethdev
`);
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const data = await loadData();

  if (opts.sources.includes('x') && !hasXSession()) {
    console.error('X enabled but no session. Paste auth_token+ct0 in the UI, or:');
    console.error('  npm run x:cookies');
    console.error('  npm run x:login');
    process.exit(1);
  }

  const enabled = data.queries.filter((q) => q.enabled);
  console.log(`Queries: ${opts.queryIds?.length ?? enabled.length} · Sources: ${opts.sources.join(',')} · Range: ${opts.timeRange}`);
  console.log(`Delay: ${data.settings.delayMs}ms`);

  const job = await createAndStartJob({
    sources: opts.sources,
    timeRange: opts.timeRange,
    queryIds: opts.queryIds,
  });

  console.log(`Job ${job.id} started…`);

  const poll = setInterval(async () => {
    const fresh = await loadData();
    const j = fresh.jobs.find((x) => x.id === job.id);
    if (!j) return;
    const p = j.progress;
    process.stdout.write(
      `\r[${j.status}] ${p.completedSteps}/${p.totalSteps} · ${p.postsFound} new · ${p.currentStep ?? ''}`.slice(0, 100),
    );
    if (['completed', 'failed', 'cancelled'].includes(j.status)) {
      clearInterval(poll);
      console.log(`\nDone. Total posts in DB: ${fresh.posts.length}`);
      if (p.errors.length) {
        console.log('Warnings:');
        for (const e of p.errors.slice(0, 10)) console.log(' -', e);
      }
      console.log('\nNext: npm run export');
      process.exit(j.status === 'failed' ? 1 : 0);
    }
  }, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
