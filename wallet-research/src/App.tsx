import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_LABELS,
  SOURCE_LABELS,
  cancelJob,
  fetchData,
  fetchHealth,
  fetchJob,
  fetchPosts,
  startSearch,
  toggleQuery,
  updatePost,
  fetchExport,
  saveXSession,
  type AppData,
  type Category,
  type Rating,
  type ResearchPost,
  type SearchJob,
  type Source,
} from './lib/api';

function formatDate(iso?: string) {
  if (!iso) return 'Unknown date';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function App() {
  const [health, setHealth] = useState({ xSession: false, googleCse: false, redditBackend: 'arctic-shift' });
  const [data, setData] = useState<AppData | null>(null);
  const [posts, setPosts] = useState<ResearchPost[]>([]);
  const [activeJob, setActiveJob] = useState<SearchJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const [source, setSource] = useState<'' | Source>('');
  const [category, setCategory] = useState<'' | Category>('');
  const [rating, setRating] = useState<'' | Rating>('');
  const [text, setText] = useState('');
  const [sort, setSort] = useState('date');
  const [sources, setSources] = useState<Source[]>(['reddit', 'google']);
  const [timeRange, setTimeRange] = useState<'year' | 'month' | 'week'>('year');
  const [exportMsg, setExportMsg] = useState('');
  const [xAuthToken, setXAuthToken] = useState('');
  const [xCt0, setXCt0] = useState('');
  const [xMsg, setXMsg] = useState('');

  const refreshPosts = useCallback(async () => {
    const params: Record<string, string> = { sort };
    if (source) params.source = source;
    if (category) params.category = category;
    if (rating) params.rating = rating;
    if (text) params.q = text;
    const res = await fetchPosts(params);
    setPosts(res.posts);
  }, [source, category, rating, text, sort]);

  const refreshAll = useCallback(async () => {
    const [h, d] = await Promise.all([fetchHealth(), fetchData()]);
    setHealth(h);
    setData(d);
    await refreshPosts();
    setLoading(false);
  }, [refreshPosts]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!loading) void refreshPosts();
  }, [refreshPosts, loading]);

  useEffect(() => {
    if (!activeJob || ['completed', 'failed', 'cancelled'].includes(activeJob.status)) return;
    const t = setInterval(async () => {
      const job = await fetchJob(activeJob.id);
      setActiveJob(job);
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        setSearching(false);
        await refreshAll();
      }
    }, 2000);
    return () => clearInterval(t);
  }, [activeJob, refreshAll]);

  const stats = useMemo(() => {
    const all = data?.posts ?? [];
    return {
      total: all.length,
      useful: all.filter((p) => p.rating === 'useful').length,
      unrated: all.filter((p) => p.rating === 'unrated').length,
      highPain: all.filter((p) => p.tags.includes('high-pain')).length,
    };
  }, [data]);

  async function handleSearch() {
    setSearching(true);
    const job = await startSearch({ sources, timeRange });
    setActiveJob(job);
  }

  async function handleRate(post: ResearchPost, next: Rating) {
    const rating = post.rating === next ? 'unrated' : next;
    const updated = await updatePost(post.id, { rating });
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function handleNotes(post: ResearchPost, notes: string) {
    const updated = await updatePost(post.id, { notes });
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function handleExport(format: 'markdown' | 'json', rating: string) {
    try {
      const text = await fetchExport(format, rating);
      await navigator.clipboard.writeText(text);
      setExportMsg(`Copied ${rating} posts (${format}) to clipboard — paste into Cursor chat`);
      setTimeout(() => setExportMsg(''), 4000);
    } catch {
      setExportMsg('Export failed — mark some posts as useful first');
      setTimeout(() => setExportMsg(''), 4000);
    }
  }

  async function handleDownload(format: 'markdown' | 'json', rating: string) {
    const text = await fetchExport(format, rating);
    const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-pain-${rating}.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveXSession() {
    try {
      await saveXSession(xAuthToken, xCt0);
      setXAuthToken('');
      setXCt0('');
      setXMsg('X session saved — you can enable X in searches');
      const h = await fetchHealth();
      setHealth(h);
      setTimeout(() => setXMsg(''), 5000);
    } catch {
      setXMsg('Failed to save session — check auth_token and ct0');
      setTimeout(() => setXMsg(''), 5000);
    }
  }

  const progressPct =
    activeJob && activeJob.progress.totalSteps
      ? Math.round((activeJob.progress.completedSteps / activeJob.progress.totalSteps) * 100)
      : 0;

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>Wallet Pain Research</h1>
          <p>
            Mine Reddit, Google, and X for crypto wallet complaints. Results are saved locally — mark posts as useful or
            not to build your research corpus.
          </p>
        </div>
        <div className="pill-row">
          <span className="pill ok">Reddit via {health.redditBackend ?? 'arctic-shift'}</span>
          <span className={`pill ${health.xSession ? 'ok' : 'warn'}`}>
            X session {health.xSession ? 'ready' : 'missing'}
          </span>
          <span className={`pill ${health.googleCse ? 'ok' : ''}`}>
            Google CSE {health.googleCse ? 'enabled' : 'DuckDuckGo fallback'}
          </span>
        </div>
      </header>

      {activeJob && !['completed', 'failed', 'cancelled'].includes(activeJob.status) && (
        <div className="job-banner running">
          <strong>Search running</strong> — {activeJob.progress.currentStep ?? 'Starting…'}
          <div className="progress-bar">
            <div style={{ width: `${progressPct}%` }} />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
            {activeJob.progress.completedSteps}/{activeJob.progress.totalSteps} steps · {activeJob.progress.postsFound}{' '}
            new posts
          </div>
          <button className="btn small" style={{ marginTop: 8 }} onClick={() => void cancelJob(activeJob.id)}>
            Cancel
          </button>
        </div>
      )}

      {activeJob?.progress.errors.length ? (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h2>Search warnings</h2>
          <ul className="errors">
            {activeJob.progress.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="layout">
        <aside>
          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>Run search</h2>
            <div className="field">
              <label>Time range</label>
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}>
                <option value="year">Past year</option>
                <option value="month">Past month</option>
                <option value="week">Past week</option>
              </select>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                checked={sources.includes('reddit')}
                onChange={(e) =>
                  setSources((s) => (e.target.checked ? [...s, 'reddit'] : s.filter((x) => x !== 'reddit')))
                }
                id="src-reddit"
              />
              <label htmlFor="src-reddit">Reddit</label>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                checked={sources.includes('google')}
                onChange={(e) =>
                  setSources((s) => (e.target.checked ? [...s, 'google'] : s.filter((x) => x !== 'google')))
                }
                id="src-google"
              />
              <label htmlFor="src-google">Google / web</label>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                checked={sources.includes('x')}
                onChange={(e) =>
                  setSources((s) => (e.target.checked ? [...s, 'x'] : s.filter((x) => x !== 'x')))
                }
                id="src-x"
              />
              <label htmlFor="src-x">X (needs login session)</label>
            </div>
            <button className="btn primary" disabled={searching || sources.length === 0} onClick={() => void handleSearch()}>
              {searching ? 'Searching…' : 'Start batch search'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              Runs slowly with delays between requests to reduce rate limits. Expect several minutes for a full batch.
            </p>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>X search setup</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Uses unofficial GraphQL via a saved login session (same as api-god-x / birdapi). Pick one method:
            </p>
            <ol style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', paddingLeft: 18 }}>
              <li>
                Terminal: <code>npm run x:setup</code> then <code>npm run x:login</code>
              </li>
              <li>Or paste cookies from DevTools → x.com → auth_token + ct0</li>
            </ol>
            <div className="field">
              <label>auth_token</label>
              <input value={xAuthToken} onChange={(e) => setXAuthToken(e.target.value)} placeholder="Paste auth_token cookie" />
            </div>
            <div className="field">
              <label>ct0</label>
              <input value={xCt0} onChange={(e) => setXCt0(e.target.value)} placeholder="Paste ct0 cookie" />
            </div>
            <button className="btn primary small" disabled={!xAuthToken || !xCt0} onClick={() => void handleSaveXSession()}>
              Save X session
            </button>
            {xMsg && <p style={{ fontSize: 12, color: 'var(--ok)', marginTop: 8, marginBottom: 0 }}>{xMsg}</p>}
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>Stats</h2>
            <div className="stats-grid">
              <div className="stat">
                <strong>{stats.total}</strong>
                <span>Total posts</span>
              </div>
              <div className="stat">
                <strong>{stats.useful}</strong>
                <span>Marked useful</span>
              </div>
              <div className="stat">
                <strong>{stats.unrated}</strong>
                <span>Unrated</span>
              </div>
              <div className="stat">
                <strong>{stats.highPain}</strong>
                <span>High-pain tags</span>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>Export for Cursor</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Mark posts as useful, then copy a batch with an analysis prompt for Cursor chat.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button className="btn primary small" onClick={() => void handleExport('markdown', 'useful')}>
                Copy useful → Cursor
              </button>
              <button className="btn small" onClick={() => void handleExport('markdown', 'high-pain')}>
                Copy high-pain
              </button>
              <button className="btn small" onClick={() => void handleDownload('markdown', 'all')}>
                Download all (.md)
              </button>
              <button className="btn small" onClick={() => void handleDownload('json', 'all')}>
                Download all (.json)
              </button>
            </div>
            {exportMsg && (
              <p style={{ fontSize: 12, color: 'var(--ok)', marginTop: 10, marginBottom: 0 }}>{exportMsg}</p>
            )}
          </div>

          <div className="panel">
            <h2>Search queries</h2>
            <div className="query-list">
              {data?.queries.map((q) => (
                <div className="checkbox-row" key={q.id}>
                  <input
                    type="checkbox"
                    checked={q.enabled}
                    onChange={(e) => {
                      void toggleQuery(q.id, e.target.checked).then(refreshAll);
                    }}
                    id={`q-${q.id}`}
                  />
                  <label htmlFor={`q-${q.id}`} title={q.query}>
                    {q.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main>
          <div className="filters">
            <input placeholder="Filter text…" value={text} onChange={(e) => setText(e.target.value)} />
            <select value={source} onChange={(e) => setSource(e.target.value as '' | Source)}>
              <option value="">All sources</option>
              {(Object.keys(SOURCE_LABELS) as Source[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value as '' | Category)}>
              <option value="">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select value={rating} onChange={(e) => setRating(e.target.value as '' | Rating)}>
              <option value="">All ratings</option>
              <option value="useful">Useful</option>
              <option value="not_useful">Not useful</option>
              <option value="unrated">Unrated</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date">Sort: date</option>
              <option value="pain">Sort: pain signals</option>
              <option value="engagement">Sort: engagement</option>
            </select>
          </div>

          {loading ? (
            <div className="empty">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="empty">
              No posts yet. Run a batch search to collect wallet pain signals from Reddit and the web.
            </div>
          ) : (
            <div className="post-list">
              {posts.map((post) => (
                <article key={post.id} className={`post-card ${post.rating}`}>
                  <div className="post-meta">
                    <span className={`badge ${post.source}`}>{SOURCE_LABELS[post.source]}</span>
                    <span className="badge">{CATEGORY_LABELS[post.primaryCategory]}</span>
                    {post.community && <span className="badge">{post.community}</span>}
                    {post.author && <span className="badge">{post.author}</span>}
                    {post.tags.includes('high-pain') && <span className="badge">high pain</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(post.postedAt ?? post.fetchedAt)}</span>
                    {post.engagement?.score != null && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>↑ {post.engagement.score}</span>
                    )}
                  </div>
                  <h3 className="post-title">
                    <a href={post.url} target="_blank" rel="noreferrer">
                      {post.title}
                    </a>
                  </h3>
                  <p className="post-snippet">{post.snippet}</p>
                  <div className="post-actions">
                    <button
                      className={`btn small useful ${post.rating === 'useful' ? 'active' : ''}`}
                      onClick={() => void handleRate(post, 'useful')}
                    >
                      Useful
                    </button>
                    <button
                      className={`btn small not-useful ${post.rating === 'not_useful' ? 'active' : ''}`}
                      onClick={() => void handleRate(post, 'not_useful')}
                    >
                      Not useful
                    </button>
                    <a className="btn small" href={post.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <input
                      className="notes-input"
                      placeholder="Notes…"
                      defaultValue={post.notes}
                      onBlur={(e) => {
                        if (e.target.value !== post.notes) void handleNotes(post, e.target.value);
                      }}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
