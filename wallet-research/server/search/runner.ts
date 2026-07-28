import { DEV_SUBREDDITS, REDDIT_SUBREDDITS } from '../queries.js';
import { createJob, getJob, loadData, updateJob, upsertPosts } from '../storage.js';
import type { SearchJob, Source } from '../types.js';
import { searchGoogle, searchGoogleCse } from './google.js';
import { searchReddit } from './reddit.js';
import { searchX } from './x.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function simplifyQueryForX(query: string): string {
  return query
    .replace(/\bsubreddit:\w+/gi, '')
    .replace(/site:\S+/gi, '')
    .replace(/[()"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function simplifyQueryForGoogle(query: string): string {
  if (query.includes('site:')) return query;
  return `${query} (site:reddit.com OR site:x.com OR site:twitter.com)`;
}

export async function runSearchJob(jobId: string): Promise<void> {
  const data = await loadData();
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) return;

  const queries = data.queries.filter((q) => job.queryIds.includes(q.id) && q.enabled);
  const steps: Array<{ label: string; source: Source; query: string; queryId: string }> = [];

  for (const q of queries) {
    for (const source of job.sources) {
      if (!q.sources.includes(source)) continue;
      steps.push({ label: q.label, source, query: q.query, queryId: q.id });
    }
  }

  const hasDevQueries = queries.some((q) => q.id.startsWith('dev-') || q.id.startsWith('reddit-eth') || q.id.includes('solidity') || q.id.includes('web3'));

  // Bonus Reddit subreddit scans
  if (job.sources.includes('reddit')) {
    for (const sub of REDDIT_SUBREDDITS.slice(0, 5)) {
      steps.push({
        label: `r/${sub} scan`,
        source: 'reddit',
        query: `wallet (problem OR help OR frustrating) subreddit:${sub}`,
        queryId: `sub-${sub.toLowerCase()}`,
      });
    }
    if (hasDevQueries) {
      for (const sub of DEV_SUBREDDITS) {
        steps.push({
          label: `r/${sub} dev scan`,
          source: 'reddit',
          query: `(MetaMask OR wallet OR wagmi OR WalletConnect) (error OR integrate OR broken) subreddit:${sub}`,
          queryId: `dev-${sub.toLowerCase()}`,
        });
      }
    }
  }

  await updateJob(jobId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: {
      totalSteps: steps.length,
      completedSteps: 0,
      currentStep: steps[0]?.label,
      postsFound: 0,
      errors: [],
    },
  });

  const settings = data.settings;
  let postsFound = 0;
  const errors: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const current = await getJob(jobId);
    if (current?.status === 'cancelled') return;

    await updateJob(jobId, {
      progress: {
        totalSteps: steps.length,
        completedSteps: i,
        currentStep: `${step.source}: ${step.label}`,
        postsFound,
        errors,
      },
    });

    try {
      let found = [] as Awaited<ReturnType<typeof searchReddit>>;

      if (step.source === 'reddit') {
        found = await searchReddit(step.query, {
          timeRange: job.timeRange,
          maxPages: settings.maxPagesPerQuery,
          delayMs: settings.delayMs,
          jobId,
        });
      } else if (step.source === 'google') {
        const gQuery = simplifyQueryForGoogle(step.query);
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;
        if (apiKey && cx) {
          found = await searchGoogleCse(gQuery, {
            apiKey,
            cx,
            maxPages: settings.maxPagesPerQuery,
            delayMs: settings.delayMs,
            jobId,
          });
        } else {
          found = await searchGoogle(gQuery, {
            maxPages: settings.maxPagesPerQuery,
            delayMs: settings.delayMs,
            jobId,
          });
        }
      } else if (step.source === 'x') {
        const xQuery = `${simplifyQueryForX(step.query)} lang:en`;
        found = await searchX(xQuery, {
          maxPages: settings.maxPagesPerQuery,
          delayMs: settings.delayMs,
          jobId,
        });
      }

      const added = await upsertPosts(found);
      postsFound += added;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${step.source}/${step.label}: ${msg.slice(0, 200)}`);
    }

    await sleep(settings.delayMs);
  }

  await updateJob(jobId, {
    status: errors.length === steps.length ? 'failed' : 'completed',
    finishedAt: new Date().toISOString(),
    progress: {
      totalSteps: steps.length,
      completedSteps: steps.length,
      postsFound,
      errors,
    },
  });
}

export function startJobAsync(jobId: string) {
  void runSearchJob(jobId).catch(async (err) => {
    await updateJob(jobId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      progress: {
        totalSteps: 0,
        completedSteps: 0,
        postsFound: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      },
    });
  });
}

export async function createAndStartJob(input: {
  queryIds?: string[];
  sources: Source[];
  timeRange: SearchJob['timeRange'];
}): Promise<SearchJob> {
  const data = await loadData();
  const queryIds =
    input.queryIds?.length
      ? input.queryIds
      : data.queries.filter((q) => q.enabled).map((q) => q.id);

  const job: SearchJob = {
    id: crypto.randomUUID(),
    status: 'queued',
    createdAt: new Date().toISOString(),
    timeRange: input.timeRange,
    sources: input.sources,
    queryIds,
    progress: {
      totalSteps: 0,
      completedSteps: 0,
      postsFound: 0,
      errors: [],
    },
  };

  await createJob(job);
  startJobAsync(job.id);
  return job;
}
