import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SESSION_FILE } from './search/x.js';
import { createAndStartJob } from './search/runner.js';
import { postsToJson, postsToMarkdown } from './export.js';
import { loadData, saveData, updatePost } from './storage.js';
import type { Rating, Source } from './types.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3847);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    xSession: existsSync(fileURLToPath(SESSION_FILE)),
    googleCse: Boolean(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CX),
    redditOAuth: Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
    redditBackend: process.env.REDDIT_CLIENT_ID ? 'oauth+arctic-fallback' : 'arctic-shift',
  });
});

app.get('/api/data', async (_req, res) => {
  const data = await loadData();
  res.json(data);
});

app.get('/api/posts', async (req, res) => {
  const data = await loadData();
  let posts = [...data.posts];

  const source = req.query.source as Source | undefined;
  const category = req.query.category as string | undefined;
  const rating = req.query.rating as Rating | undefined;
  const q = String(req.query.q ?? '').toLowerCase();

  if (source) posts = posts.filter((p) => p.source === source);
  if (category) posts = posts.filter((p) => p.primaryCategory === category || p.categories.includes(category as never));
  if (rating) posts = posts.filter((p) => p.rating === rating);
  if (q) {
    posts = posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.snippet.toLowerCase().includes(q) ||
        p.author?.toLowerCase().includes(q) ||
        p.community?.toLowerCase().includes(q),
    );
  }

  const sort = String(req.query.sort ?? 'date');
  if (sort === 'pain') {
    posts.sort((a, b) => (b.tags.includes('high-pain') ? 1 : 0) - (a.tags.includes('high-pain') ? 1 : 0));
  } else if (sort === 'engagement') {
    posts.sort((a, b) => (b.engagement?.score ?? 0) - (a.engagement?.score ?? 0));
  }

  res.json({ posts, total: posts.length });
});

app.patch('/api/posts/:id', async (req, res) => {
  const updated = await updatePost(req.params.id, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }
  res.json(updated);
});

app.post('/api/search', async (req, res) => {
  const { queryIds, sources, timeRange } = req.body as {
    queryIds?: string[];
    sources?: Source[];
    timeRange?: 'year' | 'month' | 'week';
  };

  const job = await createAndStartJob({
    queryIds,
    sources: sources ?? ['reddit', 'google'],
    timeRange: timeRange ?? 'year',
  });

  res.status(202).json(job);
});

app.get('/api/jobs/:id', async (req, res) => {
  const data = await loadData();
  const job = data.jobs.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

app.post('/api/jobs/:id/cancel', async (req, res) => {
  const data = await loadData();
  const idx = data.jobs.findIndex((j) => j.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  if (data.jobs[idx].status === 'running' || data.jobs[idx].status === 'queued') {
    data.jobs[idx] = { ...data.jobs[idx], status: 'cancelled', finishedAt: new Date().toISOString() };
    await saveData(data);
  }
  res.json(data.jobs[idx]);
});

app.patch('/api/settings', async (req, res) => {
  const data = await loadData();
  data.settings = { ...data.settings, ...req.body };
  await saveData(data);
  res.json(data.settings);
});

app.patch('/api/queries/:id', async (req, res) => {
  const data = await loadData();
  const idx = data.queries.findIndex((q) => q.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Query not found' });
    return;
  }
  data.queries[idx] = { ...data.queries[idx], ...req.body };
  await saveData(data);
  res.json(data.queries[idx]);
});

app.get('/api/export', async (req, res) => {
  const data = await loadData();
  const rating = String(req.query.rating ?? 'useful') as Rating | 'all' | 'high-pain';
  const format = String(req.query.format ?? 'markdown');

  let posts = [...data.posts];
  if (rating === 'useful') posts = posts.filter((p) => p.rating === 'useful');
  else if (rating === 'not_useful') posts = posts.filter((p) => p.rating === 'not_useful');
  else if (rating === 'unrated') posts = posts.filter((p) => p.rating === 'unrated');
  else if (rating === 'high-pain') posts = posts.filter((p) => p.tags.includes('high-pain'));

  if (format === 'json') {
    res.json(postsToJson(posts));
    return;
  }

  const markdown = postsToMarkdown(posts, true);
  res.type('text/markdown').send(markdown);
});

app.listen(PORT, () => {
  console.log(`Wallet research API on http://localhost:${PORT}`);
});
