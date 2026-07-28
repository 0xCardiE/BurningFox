import { fileURLToPath } from 'node:url';
import { DEFAULT_QUERIES } from './queries.js';
import type { AppData, ResearchPost, SearchJob, SearchQuery } from './types.js';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
export const DATA_FILE = fileURLToPath(new URL('./store.json', new URL('../data/', import.meta.url)));

const DEFAULT_DATA: AppData = {
  posts: [],
  jobs: [],
  queries: DEFAULT_QUERIES,
  settings: {
    delayMs: 1000,
    maxPagesPerQuery: 2,
  },
};

let cache: AppData | null = null;
/** mtimeMs of DATA_FILE when cache was loaded — detects CLI writes from another process */
let cacheMtimeMs = 0;

async function ensureDataDir() {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(DATA_DIR, { recursive: true });
}

async function fileMtimeMs(): Promise<number> {
  try {
    const { stat } = await import('node:fs/promises');
    const s = await stat(DATA_FILE);
    return s.mtimeMs;
  } catch {
    return 0;
  }
}

function mergeQueries(stored: SearchQuery[] | undefined) {
  if (!stored?.length) return DEFAULT_QUERIES;
  const storedById = new Map(stored.map((q) => [q.id, q]));
  // Refresh query text / sources / xQuery from code; keep user's enabled toggle
  const merged = DEFAULT_QUERIES.map((def) => {
    const s = storedById.get(def.id);
    if (!s) return def;
    return { ...def, enabled: s.enabled };
  });
  for (const q of stored) {
    if (!DEFAULT_QUERIES.some((d) => d.id === q.id)) merged.push(q);
  }
  return merged;
}

export async function loadData(): Promise<AppData> {
  await ensureDataDir();
  const mtime = await fileMtimeMs();

  // Reload when another process (CLI search/prune) updated the file
  if (cache && mtime > 0 && mtime === cacheMtimeMs) {
    return cache;
  }

  try {
    const { readFile } = await import('node:fs/promises');
    const text = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(text) as AppData;
    cache = {
      ...DEFAULT_DATA,
      ...parsed,
      queries: mergeQueries(parsed.queries),
      settings: { ...DEFAULT_DATA.settings, ...parsed.settings },
    };
    cacheMtimeMs = mtime || (await fileMtimeMs());
    return cache;
  } catch {
    cache = structuredClone(DEFAULT_DATA);
    await saveData(cache);
    return cache;
  }
}

export async function saveData(data: AppData): Promise<void> {
  cache = data;
  await ensureDataDir();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  cacheMtimeMs = await fileMtimeMs();
}

export function invalidateCache(): void {
  cache = null;
  cacheMtimeMs = 0;
}

export function postKey(source: ResearchPost['source'], url: string): string {
  return `${source}:${url}`;
}

export async function upsertPosts(posts: ResearchPost[]): Promise<number> {
  const data = await loadData();
  const byId = new Map(data.posts.map((p) => [p.id, p]));
  let added = 0;

  for (const post of posts) {
    const existing = byId.get(post.id);
    if (!existing) {
      byId.set(post.id, post);
      added++;
      continue;
    }
    byId.set(post.id, {
      ...post,
      rating: existing.rating,
      notes: existing.notes,
      tags: existing.tags.length ? existing.tags : post.tags,
    });
  }

  data.posts = [...byId.values()].sort(
    (a, b) => new Date(b.postedAt ?? b.fetchedAt).getTime() - new Date(a.postedAt ?? a.fetchedAt).getTime(),
  );
  await saveData(data);
  return added;
}

export async function updatePost(
  id: string,
  patch: Partial<Pick<ResearchPost, 'rating' | 'notes' | 'tags' | 'categories' | 'primaryCategory'>>,
): Promise<ResearchPost | null> {
  const data = await loadData();
  const idx = data.posts.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  data.posts[idx] = { ...data.posts[idx], ...patch };
  await saveData(data);
  return data.posts[idx];
}

export async function createJob(job: SearchJob): Promise<SearchJob> {
  const data = await loadData();
  data.jobs.unshift(job);
  data.jobs = data.jobs.slice(0, 50);
  await saveData(data);
  return job;
}

export async function updateJob(id: string, patch: Partial<SearchJob>): Promise<SearchJob | null> {
  const data = await loadData();
  const idx = data.jobs.findIndex((j) => j.id === id);
  if (idx === -1) return null;
  data.jobs[idx] = { ...data.jobs[idx], ...patch };
  await saveData(data);
  return data.jobs[idx];
}

export async function getJob(id: string): Promise<SearchJob | null> {
  const data = await loadData();
  return data.jobs.find((j) => j.id === id) ?? null;
}
