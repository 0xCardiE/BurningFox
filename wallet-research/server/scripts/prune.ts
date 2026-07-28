/**
 * Remove posts that fail the wallet-relevance gate from the store.
 * Usage: npm run prune
 *        npm run prune -- --dry-run
 */
import { isWalletRelevant } from '../relevance.js';
import { loadData, saveData } from '../storage.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const data = await loadData();
  const before = data.posts.length;
  const kept = data.posts.filter((p) => isWalletRelevant(p.title, p.snippet));
  const removed = before - kept.length;

  console.log(`Posts: ${before} total → ${kept.length} relevant (${removed} noise)`);

  if (dryRun) {
    console.log('Dry run — store unchanged. Re-run without --dry-run to prune.');
    return;
  }

  if (removed === 0) {
    console.log('Nothing to prune.');
    return;
  }

  data.posts = kept;
  await saveData(data);
  console.log(`Pruned ${removed} posts from store.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
