import type {
  AppData,
  Category,
  Rating,
  ResearchPost,
  SearchJob,
  Source,
} from '../../server/types';
import { CATEGORY_LABELS, SOURCE_LABELS } from '../../server/types';

const BASE = '/api';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export function fetchHealth() {
  return api<{ ok: boolean; xSession: boolean; googleCse: boolean; redditBackend?: string }>('/health');
}

export function fetchData() {
  return api<AppData>('/data');
}

export function fetchPosts(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return api<{ posts: ResearchPost[]; total: number }>(`/posts?${qs}`);
}

export function updatePost(id: string, patch: Partial<Pick<ResearchPost, 'rating' | 'notes' | 'tags'>>) {
  return api<ResearchPost>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export function startSearch(body: {
  queryIds?: string[];
  sources: Source[];
  timeRange: 'year' | 'month' | 'week';
}) {
  return api<SearchJob>('/search', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchJob(id: string) {
  return api<SearchJob>(`/jobs/${id}`);
}

export function cancelJob(id: string) {
  return api<SearchJob>(`/jobs/${id}/cancel`, { method: 'POST' });
}

export function updateSettings(settings: Partial<AppData['settings']>) {
  return api<AppData['settings']>('/settings', { method: 'PATCH', body: JSON.stringify(settings) });
}

export function toggleQuery(id: string, enabled: boolean) {
  return api(`/queries/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
}

export async function saveXSession(authToken: string, ct0: string) {
  return api<{ ok: boolean; message: string }>('/x/session', {
    method: 'POST',
    body: JSON.stringify({ authToken, ct0 }),
  });
}

export async function clearXSession() {
  return api<{ ok: boolean }>('/x/session', { method: 'DELETE' });
}

export async function fetchExport(format: 'markdown' | 'json' | 'compact', rating = 'all'): Promise<string> {
  const res = await fetch(`${BASE}/export?format=${format}&rating=${rating}`);
  if (!res.ok) throw new Error(await res.text());
  return format === 'json' ? JSON.stringify(await res.json(), null, 2) : res.text();
}

export { CATEGORY_LABELS, SOURCE_LABELS };
export type { Category, Rating, ResearchPost, SearchJob, Source, AppData };
