import { CATEGORY_LABELS, SOURCE_LABELS } from './types.js';
import type { Category, ResearchPost } from './types.js';

const LLM_PROMPT = `You are analyzing crypto wallet pain signals collected from Reddit, web search, and X.

Goals:
1. Cluster posts into the strongest recurring product problems (end-user AND developer).
2. For each cluster: who feels it, what fails, severity (1-5), how common it looks, and a concrete product opportunity.
3. Rank the top opportunities for a new wallet / wallet UX.
4. Call out noise / off-topic items to ignore.

Auto-categories below are keyword guesses — correct them if wrong.

Dataset:`;

export function summarizeByCategory(posts: ResearchPost[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    const key = CATEGORY_LABELS[p.primaryCategory] ?? p.primaryCategory;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function postsToMarkdown(posts: ResearchPost[], includePrompt = true): string {
  const lines: string[] = [];
  const byCat = summarizeByCategory(posts);

  if (includePrompt) {
    lines.push(LLM_PROMPT, '');
  }

  lines.push(`# Wallet pain corpus (${posts.length} posts)`, '');
  lines.push('## Category breakdown', '');
  for (const [cat, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${cat}: ${n}`);
  }
  lines.push('', '## Posts', '');

  for (const [i, p] of posts.entries()) {
    lines.push(
      `### ${i + 1}. ${p.title}`,
      `- Source: ${SOURCE_LABELS[p.source]}`,
      `- Category: ${CATEGORY_LABELS[p.primaryCategory]}`,
      p.categories.length > 1 ? `- Also: ${p.categories.map((c) => CATEGORY_LABELS[c]).join(', ')}` : '',
      `- Link: ${p.url}`,
      p.community ? `- Community: ${p.community}` : '',
      p.author ? `- Author: ${p.author}` : '',
      p.tags.length ? `- Tags: ${p.tags.join(', ')}` : '',
      p.postedAt ? `- Posted: ${p.postedAt}` : '',
      '',
      p.snippet,
      '',
      '---',
      '',
    );
  }

  return lines.filter((l) => l !== '').join('\n');
}

/** Compact export for smaller LLM context windows */
export function postsToCompactMarkdown(posts: ResearchPost[], includePrompt = true): string {
  const lines: string[] = [];
  if (includePrompt) lines.push(LLM_PROMPT, '');
  lines.push(`# Corpus (${posts.length} posts)`, '');

  const byCat = new Map<Category, ResearchPost[]>();
  for (const p of posts) {
    const list = byCat.get(p.primaryCategory) ?? [];
    list.push(p);
    byCat.set(p.primaryCategory, list);
  }

  for (const [cat, items] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`## ${CATEGORY_LABELS[cat]} (${items.length})`, '');
    for (const p of items) {
      const meta = [SOURCE_LABELS[p.source], p.community, p.tags.includes('high-pain') ? 'high-pain' : '']
        .filter(Boolean)
        .join(' · ');
      lines.push(`- **${p.title}** (${meta})`);
      lines.push(`  ${p.snippet.replace(/\s+/g, ' ').slice(0, 220)}`);
      lines.push(`  ${p.url}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function postsToJson(posts: ResearchPost[]) {
  return {
    exportedAt: new Date().toISOString(),
    count: posts.length,
    categoryBreakdown: summarizeByCategory(posts),
    llmPrompt: LLM_PROMPT,
    posts: posts.map((p) => ({
      title: p.title,
      url: p.url,
      source: p.source,
      primaryCategory: p.primaryCategory,
      categories: p.categories,
      snippet: p.snippet,
      community: p.community,
      author: p.author,
      postedAt: p.postedAt,
      tags: p.tags,
      engagement: p.engagement,
    })),
  };
}

export { LLM_PROMPT };
