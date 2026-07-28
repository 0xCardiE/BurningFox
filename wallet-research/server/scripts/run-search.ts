import { createAndStartJob } from '../search/runner.js';
import { loadData } from '../storage.js';

async function main() {
  const data = await loadData();
  console.log(`Starting search with ${data.queries.filter((q) => q.enabled).length} queries…`);
  console.log(`Delay: ${data.settings.delayMs}ms between steps`);

  const job = await createAndStartJob({
    sources: ['reddit', 'google'],
    timeRange: 'year',
  });

  console.log(`Job ${job.id} started. Watch progress in the UI or poll /api/jobs/${job.id}`);

  const poll = setInterval(async () => {
    const fresh = await loadData();
    const j = fresh.jobs.find((x) => x.id === job.id);
    if (!j) return;
    const p = j.progress;
    process.stdout.write(`\r[${j.status}] ${p.completedSteps}/${p.totalSteps} · ${p.postsFound} new posts`);
    if (['completed', 'failed', 'cancelled'].includes(j.status)) {
      clearInterval(poll);
      console.log('\nDone.');
      if (p.errors.length) {
        console.log('Errors:');
        for (const e of p.errors) console.log(' -', e);
      }
      process.exit(j.status === 'failed' ? 1 : 0);
    }
  }, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
