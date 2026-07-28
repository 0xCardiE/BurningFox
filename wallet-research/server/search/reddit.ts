import { categorizeText, painScore } from '../categorize.js';
import { REDDIT_SUBREDDITS } from '../queries.js';
import { isWalletRelevant, WALLET_SEED_PREFERRED } from '../relevance.js';
import { postKey } from '../storage.js';
import type { ResearchPost } from '../types.js';

const USER_AGENT = 'wallet-research/1.0 (local research; by /u/walletresearch)';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function afterDate(timeRange: 'year' | 'month' | 'week'): string {
  const d = new Date();
  if (timeRange === 'year') d.setFullYear(d.getFullYear() - 1);
  else if (timeRange === 'month') d.setMonth(d.getMonth() - 1);
  else d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function parseSubreddit(query: string): string | null {
  const m = query.match(/\bsubreddit:(\w+)/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Arctic Shift only handles short terms. Prefer wallet anchors from the query;
 * never fall back to bare pain words like "help" / "problem" alone.
 */
function seedKeywords(query: string): string[] {
  const stop = new Set([
    'or', 'and', 'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with', 'from',
    'crypto', 'site', 'reddit', 'com', 'stackoverflow', 'problem', 'issue',
    'help', 'error', 'failed', 'frustrating', 'confused', 'broken', 'hate',
  ]);

  const raw = query
    .replace(/\bsubreddit:\w+/gi, ' ')
    .replace(/site:\S+/gi, ' ')
    .replace(/[()"]/g, ' ')
    .replace(/\bOR\b|\bAND\b/gi, ' ')
    .toLowerCase();

  const found = WALLET_SEED_PREFERRED.filter((p) => raw.includes(p));
  if (found.length) return [...new Set(found)].slice(0, 4);

  const tokens = raw
    .split(/[^a-z0-9+-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !stop.has(t));

  const seeds = [...new Set(tokens)].slice(0, 3);
  // Always keep at least one wallet-ish seed so Arctic never searches "help" alone
  if (!seeds.some((s) => (WALLET_SEED_PREFERRED as readonly string[]).includes(s))) {
    seeds.unshift('wallet');
  }
  return seeds.slice(0, 4);
}

interface RedditOAuthToken {
  access_token: string;
  expires_in: number;
}

let oauthCache: { token: string; expiresAt: number } | null = null;

async function getOAuthToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (oauthCache && oauthCache.expiresAt > Date.now() + 30_000) {
    return oauthCache.token;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) return null;
  const json = (await res.json()) as RedditOAuthToken;
  oauthCache = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

interface OAuthListing {
  data?: {
    after?: string | null;
    children?: Array<{ data: ArcticPost }>;
  };
}

async function searchRedditOAuth(
  query: string,
  options: { timeRange: 'year' | 'month' | 'week'; maxPages: number; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  const token = await getOAuthToken();
  if (!token) throw new Error('Reddit OAuth not configured');

  const posts: ResearchPost[] = [];
  const seen = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < options.maxPages; page++) {
    const params = new URLSearchParams({
      q: query,
      sort: 'relevance',
      t: options.timeRange,
      limit: '100',
      restrict_sr: 'false',
    });
    if (after) params.set('after', after);

    const res = await fetch(`https://oauth.reddit.com/search?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      throw new Error(`Reddit OAuth search failed (${res.status})`);
    }

    const json = (await res.json()) as OAuthListing;
    const children = json.data?.children ?? [];
    after = json.data?.after ?? undefined;

    for (const child of children) {
      const mapped = mapRedditPost(child.data, query, options.jobId, seen);
      if (mapped) posts.push(mapped);
    }

    if (!after || children.length === 0) break;
    await sleep(options.delayMs);
  }

  return posts;
}

interface ArcticPost {
  id: string;
  title: string;
  selftext?: string;
  url: string;
  permalink?: string;
  author: string;
  subreddit: string;
  created_utc: number;
  score: number;
  num_comments: number;
}

interface ArcticResponse {
  data?: ArcticPost[];
  error?: string;
}

function mapRedditPost(
  d: ArcticPost,
  query: string,
  jobId: string | undefined,
  seen: Set<string>,
): ResearchPost | null {
  const permalink = d.permalink?.startsWith('/')
    ? `https://www.reddit.com${d.permalink}`
    : d.url;
  const link = permalink.startsWith('http')
    ? permalink
    : `https://www.reddit.com/r/${d.subreddit}/comments/${d.id}`;
  const id = postKey('reddit', link);
  if (seen.has(id)) return null;
  seen.add(id);

  const snippet = (d.selftext || d.title).slice(0, 400);
  if (!isWalletRelevant(d.title, snippet)) return null;

  const { categories, primaryCategory } = categorizeText(d.title, snippet);

  return {
    id,
    source: 'reddit',
    title: d.title,
    snippet,
    url: link,
    author: d.author,
    community: `r/${d.subreddit}`,
    postedAt: new Date(d.created_utc * 1000).toISOString(),
    query,
    categories,
    primaryCategory,
    engagement: { score: d.score, comments: d.num_comments },
    rating: 'unrated',
    notes: '',
    tags: painScore(d.title, snippet) >= 2 ? ['high-pain'] : [],
    fetchedAt: new Date().toISOString(),
    jobId,
  };
}

async function arcticFetch(
  subreddit: string,
  params: Record<string, string>,
): Promise<ArcticPost[]> {
  const qs = new URLSearchParams({
    subreddit: subreddit.toLowerCase(),
    ...params,
  });

  const res = await fetch(`https://arctic-shift.photon-reddit.com/api/posts/search?${qs}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    // Active subs sometimes 422/timeout — treat as empty and let caller try fallbacks
    if (res.status === 422 || res.status === 429 || res.status === 503) return [];
    throw new Error(`Arctic Shift failed (${res.status}) for r/${subreddit}`);
  }

  const json = (await res.json()) as ArcticResponse;
  if (json.error) return [];
  return json.data ?? [];
}

async function searchArcticShiftSubreddit(
  subreddit: string,
  queryText: string,
  options: { timeRange: 'year' | 'month' | 'week'; delayMs: number; jobId?: string },
  seen: Set<string>,
): Promise<ResearchPost[]> {
  const after = afterDate(options.timeRange);
  const seeds = seedKeywords(queryText);
  const posts: ResearchPost[] = [];
  const label = queryText || 'wallet pain';

  // 1) Short keyword searches (wallet anchors only — Arctic can't do boolean)
  const seedsToTry = (seeds.length ? seeds : ['wallet', 'metamask']).slice(0, 2);
  for (const seed of seedsToTry) {
    const rows = await arcticFetch(subreddit, {
      query: seed,
      after,
      limit: '50',
      sort: 'desc',
    });
    for (const d of rows) {
      const mapped = mapRedditPost(
        { ...d, permalink: d.permalink ?? `/r/${d.subreddit}/comments/${d.id}` },
        `${label} subreddit:${subreddit}`,
        options.jobId,
        seen,
      );
      if (mapped) posts.push(mapped);
    }
    await sleep(400);
  }

  // 2) Fallback: recent posts, still gated by isWalletRelevant inside mapRedditPost
  if (posts.length < 8) {
    const recent = await arcticFetch(subreddit, {
      after,
      limit: '75',
      sort: 'desc',
    });
    for (const d of recent) {
      const mapped = mapRedditPost(
        { ...d, permalink: d.permalink ?? `/r/${d.subreddit}/comments/${d.id}` },
        `${label} subreddit:${subreddit}`,
        options.jobId,
        seen,
      );
      if (mapped) posts.push(mapped);
    }
  }

  return posts;
}

async function searchArcticShift(
  query: string,
  options: { timeRange: 'year' | 'month' | 'week'; maxPages: number; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  const seen = new Set<string>();
  const posts: ResearchPost[] = [];
  const explicitSub = parseSubreddit(query);
  const subreddits = explicitSub ? [explicitSub] : REDDIT_SUBREDDITS.map((s) => s.toLowerCase());
  // Broad queries: hit a few high-signal subs, not the whole list every time
  const limit = explicitSub ? 1 : Math.min(4, options.maxPages + 1);

  for (const sub of subreddits.slice(0, limit)) {
    try {
      const found = await searchArcticShiftSubreddit(sub, query, options, seen);
      posts.push(...found);
    } catch {
      // continue other subs
    }
    await sleep(Math.min(options.delayMs, 800));
  }

  return posts;
}

export async function searchReddit(
  query: string,
  options: { timeRange: 'year' | 'month' | 'week'; maxPages: number; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  if (process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET) {
    try {
      return await searchRedditOAuth(query, options);
    } catch {
      // fall through to Arctic Shift
    }
  }

  return searchArcticShift(query, options);
}

export async function searchRedditSubreddit(
  subreddit: string,
  keyword: string,
  options: { timeRange: 'year' | 'month' | 'week'; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  const seen = new Set<string>();
  return searchArcticShiftSubreddit(subreddit.toLowerCase(), keyword, options, seen);
}
