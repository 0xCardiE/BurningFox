import * as cheerio from 'cheerio';
import { categorizeText, painScore } from '../categorize.js';
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
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed (${res.status})`);
  }
  return res.text();
}

function extractResults(html: string): Array<{ title: string; url: string; snippet: string }> {
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

function isRelevantWalletUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes('reddit.com') ||
    u.includes('x.com') ||
    u.includes('twitter.com') ||
    u.includes('medium.com') ||
    u.includes('stackoverflow.com') ||
    u.includes('github.com') ||
    u.includes('trustpilot') ||
    u.includes('producthunt') ||
    u.includes('news.ycombinator.com')
  );
}

function isWalletRelevant(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`.toLowerCase();
  return [
    'wallet', 'metamask', 'phantom', 'crypto', 'ethereum', 'bitcoin', 'solana',
    'seed phrase', 'recovery phrase', 'ledger', 'trezor', 'defi', 'web3', 'gas fee',
    'token', 'blockchain', 'swap', 'bridge', 'dapp',
    'wagmi', 'viem', 'ethers', 'walletconnect', 'hardhat', 'foundry', 'rpc', 'chainid',
  ].some((k) => text.includes(k));
}

export async function searchGoogle(
  query: string,
  options: GoogleSearchOptions,
): Promise<ResearchPost[]> {
  const posts: ResearchPost[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < options.maxPages; page++) {
    const offset = page * 30;
    const html = await fetchDuckDuckGoPage(query, offset);
    const results = extractResults(html);

    for (const r of results) {
      if (!isRelevantWalletUrl(r.url)) continue;
      if (!isWalletRelevant(r.title, r.snippet)) continue;
      const id = postKey('google', r.url);
      if (seen.has(id)) continue;
      seen.add(id);

      const { categories, primaryCategory } = categorizeText(r.title, r.snippet);
      posts.push({
        id,
        source: 'google',
        title: r.title,
        snippet: r.snippet,
        url: r.url,
        query,
        categories,
        primaryCategory,
        rating: 'unrated',
        notes: '',
        tags: painScore(r.title, r.snippet) >= 2 ? ['high-pain'] : [],
        fetchedAt: new Date().toISOString(),
        jobId: options.jobId,
      });
    }

    if (results.length < 5) break;
    await sleep(options.delayMs);
  }

  return posts;
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
      seen.add(id);

      const { categories, primaryCategory } = categorizeText(item.title, item.snippet);
      posts.push({
        id,
        source: 'google',
        title: item.title,
        snippet: item.snippet,
        url: item.link,
        query,
        categories,
        primaryCategory,
        rating: 'unrated',
        notes: '',
        tags: [],
        fetchedAt: new Date().toISOString(),
        jobId: options.jobId,
      });
    }

    if (!json.items?.length) break;
    await sleep(options.delayMs);
  }

  return posts;
}
