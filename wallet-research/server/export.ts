import { CATEGORY_LABELS, SOURCE_LABELS } from './types.js';
import type { ResearchPost } from './types.js';

const CURSOR_PROMPT = `Analyze these crypto wallet user pain posts. For each post identify:
1. What the user was trying to do
2. What went wrong or confused them
3. Severity (1-5) and whether it's a product opportunity
4. Better category if my auto-tags are wrong

Then synthesize across all posts:
- Top 5 recurring pain themes
- Gaps current wallets don't solve
- Features worth building for a new wallet

Posts:`;

export function postsToMarkdown(posts: ResearchPost[], includePrompt = true): string {
  const lines: string[] = [];

  if (includePrompt) {
    lines.push(CURSOR_PROMPT, '');
  }

  for (const [i, p] of posts.entries()) {
    lines.push(
      `### ${i + 1}. ${p.title}`,
      `- **Source:** ${SOURCE_LABELS[p.source]}`,
      `- **Category:** ${CATEGORY_LABELS[p.primaryCategory]}`,
      `- **Link:** ${p.url}`,
      p.community ? `- **Community:** ${p.community}` : '',
      p.author ? `- **Author:** ${p.author}` : '',
      p.notes ? `- **My notes:** ${p.notes}` : '',
      '',
      p.snippet,
      '',
      '---',
      '',
    );
  }

  return lines.filter(Boolean).join('\n');
}

export function postsToJson(posts: ResearchPost[]) {
  return {
    exportedAt: new Date().toISOString(),
    count: posts.length,
    cursorPrompt: CURSOR_PROMPT,
    posts: posts.map((p) => ({
      title: p.title,
      url: p.url,
      source: p.source,
      primaryCategory: p.primaryCategory,
      categories: p.categories,
      snippet: p.snippet,
      notes: p.notes,
      community: p.community,
      author: p.author,
      postedAt: p.postedAt,
      tags: p.tags,
    })),
  };
}

export { CURSOR_PROMPT };
