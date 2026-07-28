import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { postsToCompactMarkdown, postsToJson, postsToMarkdown } from '../export.js';
import { loadData } from '../storage.js';
import type { ResearchPost } from '../types.js';

function parseArgs(argv: string[]) {
  const out: {
    format: 'markdown' | 'compact' | 'json';
    filter: 'all' | 'high-pain' | CategoryFilter;
    limit?: number;
    file?: string;
  } = { format: 'compact', filter: 'all' };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--format' || a === '-f') out.format = argv[++i] as typeof out.format;
    else if (a === '--filter') out.filter = argv[++i] as typeof out.filter;
    else if (a === '--limit') out.limit = Number(argv[++i]);
    else if (a === '--out' || a === '-o') out.file = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: npm run export -- [options]

Options:
  --format, -f   markdown | compact | json   (default: compact)
  --filter       all | high-pain | <category> (default: all)
  --limit N      max posts to include
  --out, -o      output file path (default: exports/wallet-pain-<timestamp>.<ext>)

Examples:
  npm run export
  npm run export -- --format json --out exports/corpus.json
  npm run export -- --filter high-pain --format compact
  npm run export -- --filter developer_integration --limit 80
`);
      process.exit(0);
    }
  }
  return out;
}

type CategoryFilter = string;

function filterPosts(posts: ResearchPost[], filter: string): ResearchPost[] {
  if (filter === 'all') return posts;
  if (filter === 'high-pain') return posts.filter((p) => p.tags.includes('high-pain'));
  return posts.filter((p) => p.primaryCategory === filter || p.categories.includes(filter as never));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const data = await loadData();
  let posts = filterPosts(data.posts, opts.filter);
  posts = [...posts].sort(
    (a, b) => new Date(b.postedAt ?? b.fetchedAt).getTime() - new Date(a.postedAt ?? a.fetchedAt).getTime(),
  );
  if (opts.limit) posts = posts.slice(0, opts.limit);

  if (posts.length === 0) {
    console.error('No posts to export. Run a search first: npm run search');
    process.exit(1);
  }

  let body: string;
  let ext: string;
  if (opts.format === 'json') {
    body = JSON.stringify(postsToJson(posts), null, 2);
    ext = 'json';
  } else if (opts.format === 'markdown') {
    body = postsToMarkdown(posts, true);
    ext = 'md';
  } else {
    body = postsToCompactMarkdown(posts, true);
    ext = 'md';
  }

  const exportsDir = fileURLToPath(new URL('../../exports/', import.meta.url));
  await mkdir(exportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = resolve(opts.file ?? `${exportsDir}wallet-pain-${stamp}.${ext}`);
  await writeFile(outPath, body, 'utf8');

  console.log(`Exported ${posts.length} posts → ${outPath}`);
  console.log(`Filter: ${opts.filter} · Format: ${opts.format}`);
  console.log('Paste that file into Cursor/ChatGPT, or open it and copy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
