import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { categorizeText, painScore } from '../categorize.js';
import { postKey } from '../storage.js';
import type { ResearchPost } from '../types.js';

const SESSION_FILE = new URL('../../data/x-session.json', import.meta.url);
const sessionPath = () => fileURLToPath(SESSION_FILE);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function hasXSession(): boolean {
  return existsSync(sessionPath());
}

interface XTweet {
  id: string;
  text: string;
  createdAt?: string;
  user?: { screen_name?: string; name?: string };
  favorite_count?: number;
  reply_count?: number;
  retweet_count?: number;
}

function tweetUrl(id: string, username?: string): string {
  if (username) return `https://x.com/${username}/status/${id}`;
  return `https://x.com/i/web/status/${id}`;
}

function extractTweetsFromGraphql(payload: unknown): XTweet[] {
  const tweets: XTweet[] = [];
  const seen = new Set<string>();

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    const obj = node as Record<string, unknown>;

    if (obj.__typename === 'Tweet' && obj.rest_id && typeof obj.legacy === 'object') {
      const legacy = obj.legacy as Record<string, unknown>;
      const id = String(obj.rest_id);
      if (seen.has(id)) return;
      seen.add(id);
      const userLegacy =
        typeof obj.core === 'object' && obj.core && typeof (obj.core as Record<string, unknown>).user_results === 'object'
          ? (((obj.core as Record<string, unknown>).user_results as Record<string, unknown>).result as Record<string, unknown>)?.legacy
          : undefined;

      tweets.push({
        id,
        text: String(legacy.full_text ?? legacy.text ?? ''),
        createdAt: legacy.created_at ? String(legacy.created_at) : undefined,
        user: userLegacy
          ? { screen_name: String((userLegacy as Record<string, unknown>).screen_name ?? ''), name: String((userLegacy as Record<string, unknown>).name ?? '') }
          : undefined,
        favorite_count: Number(legacy.favorite_count ?? 0),
        reply_count: Number(legacy.reply_count ?? 0),
        retweet_count: Number(legacy.retweet_count ?? 0),
      });
      return;
    }

    for (const value of Object.values(obj)) walk(value);
  }

  walk(payload);
  return tweets;
}

export async function searchXWithPlaywright(
  query: string,
  options: { maxPages: number; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  let playwright: typeof import('playwright');
  try {
    playwright = await import('playwright');
  } catch {
    throw new Error('Playwright not installed. Run: npm install && npx playwright install chromium');
  }

  const { existsSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const statePath = fileURLToPath(SESSION_FILE);
  if (!existsSync(statePath)) {
    throw new Error('No X session found. Run: npm run x:login');
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: statePath });
  const page = await context.newPage();

  const collected: XTweet[] = [];
  const seenIds = new Set<string>();

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('SearchTimeline') && !url.includes('SearchAdaptive')) return;
    try {
      const json = await response.json();
      for (const t of extractTweetsFromGraphql(json)) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          collected.push(t);
        }
      }
    } catch {
      // ignore non-json
    }
  });

  const encoded = encodeURIComponent(query);
  await page.goto(`https://x.com/search?q=${encoded}&src=typed_query&f=live`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  await sleep(3000);

  for (let i = 0; i < options.maxPages; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await sleep(options.delayMs);
  }

  await browser.close();

  return collected.map((t) => {
    const title = t.text.slice(0, 120) + (t.text.length > 120 ? '…' : '');
    const snippet = t.text.slice(0, 400);
    const { categories, primaryCategory } = categorizeText(title, snippet);
    const username = t.user?.screen_name;
    const url = tweetUrl(t.id, username);

    return {
      id: postKey('x', url),
      source: 'x' as const,
      title,
      snippet,
      url,
      author: username ? `@${username}` : undefined,
      postedAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
      query,
      categories,
      primaryCategory,
      engagement: {
        likes: t.favorite_count,
        comments: t.reply_count,
        score: (t.favorite_count ?? 0) + (t.retweet_count ?? 0),
      },
      rating: 'unrated' as const,
      notes: '',
      tags: painScore(title, snippet) >= 2 ? ['high-pain'] : [],
      fetchedAt: new Date().toISOString(),
      jobId: options.jobId,
    };
  });
}

/** Fallback: search via Nitter-style public search is unreliable; use Playwright path */
export async function searchX(
  query: string,
  options: { maxPages: number; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  return searchXWithPlaywright(query, options);
}

export { SESSION_FILE };
