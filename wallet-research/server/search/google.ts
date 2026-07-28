import * as cheerio from 'cheerio';
import { categorizeText, painScore } from '../categorize.js';
import { isWalletRelevant } from '../relevance.js';
import { postKey } from '../storage.js';
import type { ResearchPost } from '../types.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface GoogleSearchOptions {
  delayMs: number;
  maxPages: number;
  jobId?: string;
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function isDiscussionUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('reddit.com') ||
    u.includes('stackoverflow.com') ||
    u.includes('stackexchange.com') ||
    u.includes('news.ycombinator.com') ||
    u.includes('github.com/') ||
    u.includes('dev.to') ||
    u.includes('medium.com') ||
    u.includes('x.com/') ||
    u.includes('twitter.com/')
  );
}

function toPost(
  title: string,
  url: string,
  snippet: string,
  query: string,
  jobId?: string,
): ResearchPost | null {
  if (!isWalletRelevant(title, snippet)) return null;
  const { categories, primaryCategory } = categorizeText(title, snippet);
  return {
    id: postKey('google', url),
    source: 'google',
    title,
    snippet,
    url,
    query,
    categories,
    primaryCategory,
    rating: 'unrated',
    notes: '',
    tags: painScore(title, snippet) >= 2 ? ['high-pain'] : [],
    fetchedAt: new Date().toISOString(),
    jobId,
  };
}

async function searchBingRss(query: string, jobId?: string): Promise<ResearchPost[]> {
  // Prefer discussion sites so we don't just get product landing pages
  const q = query.includes('site:')
    ? query
    : `${query} (site:reddit.com OR site:stackoverflow.com OR site:news.ycombinator.com OR site:dev.to)`;

  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, text/xml, */*' } });
  if (!res.ok) throw new Error(`Bing RSS failed (${res.status})`);
  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const posts: ResearchPost[] = [];
  const seen = new Set<string>();

  $('item').each((_, el) => {
    const title = $(el).find('title').first().text().trim();
    const link = $(el).find('link').first().text().trim();
    const snippet = $(el).find('description').first().text().trim();
    if (!title || !link.startsWith('http')) return;
    if (!isDiscussionUrl(link)) return;
    const id = postKey('google', link);
    if (seen.has(id)) return;
    const post = toPost(title, link, snippet.slice(0, 400), query, jobId);
    if (!post) return;
    seen.add(id);
    posts.push(post);
  });

  return posts;
}

async function fetchDuckDuckGoPage(query: string, offset: number): Promise<string> {
  const body = new URLSearchParams({
    q: query,
    s: String(offset),
    kl: 'us-en',
  });

  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      'User-Agent': UA,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed (${res.status})`);
  }
  return res.text();
}

function extractDdgResults(html: string): Array<{ title: string; url: string; snippet: string }> {
  const $ = cheerio.load(html);
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  $('.result, .results_links, .web-result').each((_, el) => {
    const link = $(el).find('a.result__a, a.result-link, h2 a').first();
    const title = link.text().trim();
    let href = link.attr('href') ?? '';

    if (href.startsWith('//duckduckgo.com/l/?') || href.startsWith('/l/?')) {
      try {
        const u = new URL(href.startsWith('//') ? `https:${href}` : `https://duckduckgo.com${href}`);
        href = u.searchParams.get('uddg') ?? href;
      } catch {
        // keep original
      }
    }

    const snippet = $(el).find('.result__snippet, .result-snippet').text().trim();
    if (title && href.startsWith('http')) {
      results.push({ title, url: href, snippet });
    }
  });

  return results;
}

async function searchDuckDuckGo(
  query: string,
  options: GoogleSearchOptions,
): Promise<ResearchPost[]> {
  const posts: ResearchPost[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < options.maxPages; page++) {
    const html = await fetchDuckDuckGoPage(query, page * 30);
    const results = extractDdgResults(html);

    for (const r of results) {
      if (!isDiscussionUrl(r.url)) continue;
      const id = postKey('google', r.url);
      if (seen.has(id)) continue;
      const post = toPost(r.title, r.url, r.snippet, query, options.jobId);
      if (!post) continue;
      seen.add(id);
      posts.push(post);
    }

    if (results.length < 5) break;
    await sleep(options.delayMs);
  }

  return posts;
}

export async function searchGoogle(
  query: string,
  options: GoogleSearchOptions,
): Promise<ResearchPost[]> {
  const byId = new Map<string, ResearchPost>();

  try {
    for (const p of await searchBingRss(query, options.jobId)) {
      byId.set(p.id, p);
    }
  } catch {
    // fall through
  }

  // DuckDuckGo often blocks bots — try anyway as supplement
  try {
    for (const p of await searchDuckDuckGo(query, { ...options, maxPages: 1 })) {
      byId.set(p.id, p);
    }
  } catch {
    // ignore
  }

  if (byId.size === 0) {
    // Last resort: simpler Bing query without site: filters
    try {
      for (const p of await searchBingRss(`${query} metamask wallet reddit`, options.jobId)) {
        byId.set(p.id, p);
      }
    } catch {
      // ignore
    }
  }

  return [...byId.values()];
}

/** Optional Google Custom Search when GOOGLE_API_KEY + GOOGLE_CX are set */
export async function searchGoogleCse(
  query: string,
  options: GoogleSearchOptions & { apiKey: string; cx: string },
): Promise<ResearchPost[]> {
  const posts: ResearchPost[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < options.maxPages; page++) {
    const start = page * 10 + 1;
    const params = new URLSearchParams({
      key: options.apiKey,
      cx: options.cx,
      q: query,
      start: String(start),
      dateRestrict: 'y1',
    });

    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!res.ok) throw new Error(`Google CSE failed (${res.status})`);
    const json = (await res.json()) as {
      items?: Array<{ title: string; link: string; snippet: string }>;
    };

    for (const item of json.items ?? []) {
      const id = postKey('google', item.link);
      if (seen.has(id)) continue;
      const post = toPost(item.title, item.link, item.snippet, query, options.jobId);
      if (!post) continue;
      seen.add(id);
      posts.push(post);
    }

    if (!json.items?.length) break;
    await sleep(options.delayMs);
  }

  return posts;
}
