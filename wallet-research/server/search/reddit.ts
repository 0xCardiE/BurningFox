import { categorizeText, painScore } from '../categorize.js';
import { REDDIT_SUBREDDITS } from '../queries.js';
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
  return m ? m[1] : null;
}

function keywordsFromQuery(query: string): string {
  return query
    .replace(/\bsubreddit:\w+/gi, '')
    .replace(/[()"]/g, ' ')
    .replace(/\bOR\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
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
    children?: Array<{
      data: {
        id: string;
        title: string;
        selftext?: string;
        url: string;
        permalink: string;
        author: string;
        subreddit: string;
        created_utc: number;
        score: number;
        num_comments: number;
      };
    }>;
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
      posts.push(mapRedditPost(child.data, query, options.jobId, seen));
    }

    if (!after || children.length === 0) break;
    await sleep(options.delayMs);
  }

  return posts.filter(Boolean) as ResearchPost[];
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
  d: {
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
  },
  query: string,
  jobId: string | undefined,
  seen: Set<string>,
): ResearchPost | null {
  const permalink = d.permalink?.startsWith('/') ? `https://www.reddit.com${d.permalink}` : d.url;
  const link = permalink.startsWith('http') ? permalink : `https://www.reddit.com/r/${d.subreddit}/comments/${d.id}`;
  const id = postKey('reddit', link);
  if (seen.has(id)) return null;
  seen.add(id);

  const snippet = (d.selftext || d.title).slice(0, 400);
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

async function searchArcticShiftSubreddit(
  subreddit: string,
  queryText: string,
  options: { timeRange: 'year' | 'month' | 'week'; delayMs: number; jobId?: string },
  seen: Set<string>,
): Promise<ResearchPost[]> {
  const params = new URLSearchParams({
    subreddit,
    query: queryText,
    after: afterDate(options.timeRange),
    limit: '100',
    sort: 'desc',
  });

  const res = await fetch(`https://arctic-shift.photon-reddit.com/api/posts/search?${params}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Arctic Shift failed (${res.status}) for r/${subreddit}`);
  }

  const json = (await res.json()) as ArcticResponse;
  if (json.error) {
    throw new Error(`Arctic Shift: ${json.error}`);
  }

  const posts: ResearchPost[] = [];
  for (const d of json.data ?? []) {
    const mapped = mapRedditPost(
      {
        ...d,
        permalink: d.permalink ?? `/r/${d.subreddit}/comments/${d.id}`,
      },
      `${queryText} subreddit:${subreddit}`,
      options.jobId,
      seen,
    );
    if (mapped) posts.push(mapped);
  }

  return posts;
}

async function searchArcticShift(
  query: string,
  options: { timeRange: 'year' | 'month' | 'week'; maxPages: number; delayMs: number; jobId?: string },
): Promise<ResearchPost[]> {
  const seen = new Set<string>();
  const posts: ResearchPost[] = [];
  const queryText = keywordsFromQuery(query);
  const explicitSub = parseSubreddit(query);

  const subreddits = explicitSub ? [explicitSub] : REDDIT_SUBREDDITS;

  for (const sub of subreddits.slice(0, options.maxPages + 2)) {
    try {
      const found = await searchArcticShiftSubreddit(sub, queryText || 'wallet problem', options, seen);
      posts.push(...found);
    } catch (err) {
      // Skip overloaded subreddits silently; surface only total failure
      if (posts.length === 0 && sub === subreddits[subreddits.length - 1]) {
        throw err;
      }
    }
    await sleep(options.delayMs);
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
  return searchArcticShiftSubreddit(subreddit, keyword, options, seen);
}
