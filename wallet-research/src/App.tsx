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
  fetchExport,
  saveXSession,
  type AppData,
  type Category,
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
  const [text, setText] = useState('');
  const [sort, setSort] = useState('pain');
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
    if (text) params.q = text;
    const res = await fetchPosts(params);
    setPosts(res.posts);
  }, [source, category, text, sort]);

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
    const byCat: Record<string, number> = {};
    for (const p of all) {
      const label = CATEGORY_LABELS[p.primaryCategory];
      byCat[label] = (byCat[label] ?? 0) + 1;
    }
    return {
      total: all.length,
      highPain: all.filter((p) => p.tags.includes('high-pain')).length,
      bySource: {
        reddit: all.filter((p) => p.source === 'reddit').length,
        google: all.filter((p) => p.source === 'google').length,
        x: all.filter((p) => p.source === 'x').length,
      },
      topCategories: Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    };
  }, [data]);

  async function handleSearch() {
    setSearching(true);
    const job = await startSearch({ sources, timeRange });
    setActiveJob(job);
  }

  async function handleExport(format: 'compact' | 'markdown' | 'json', filter: string) {
    try {
      const text = await fetchExport(format, filter);
      await navigator.clipboard.writeText(text);
      setExportMsg(`Copied ${filter} corpus (${format}) — paste into Cursor / any LLM`);
      setTimeout(() => setExportMsg(''), 5000);
    } catch {
      setExportMsg('Export failed');
      setTimeout(() => setExportMsg(''), 4000);
    }
  }

  async function handleDownload(format: 'compact' | 'markdown' | 'json', filter: string) {
    const text = await fetchExport(format, filter);
    const ext = format === 'json' ? 'json' : 'md';
    const blob = new Blob([text], { type: format === 'json' ? 'application/json' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wallet-pain-${filter}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveXSession() {
    const auth = xAuthToken.trim();
    const ct0 = xCt0.trim();
    if (!auth || !ct0) {
      setXMsg('Need both auth_token and ct0 (not __cf_bm / _cuid)');
      return;
    }
    if (auth.length < 20 || ct0.length < 20) {
      setXMsg('Those values look too short — scroll cookies for auth_token and ct0');
      return;
    }
    try {
      await saveXSession(auth, ct0);
      setXAuthToken('');
      setXCt0('');
      setXMsg('X session saved');
      const h = await fetchHealth();
      setHealth(h);
      setTimeout(() => setXMsg(''), 5000);
    } catch {
      setXMsg('Failed to save — check auth_token and ct0');
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
            Source Reddit / web / X into a local corpus, auto-tag it, then export for LLM analysis. No manual
            approval needed — the file is the database.
          </p>
        </div>
        <div className="pill-row">
          <span className="pill ok">{stats.total} posts</span>
          <span className={`pill ${health.xSession ? 'ok' : 'warn'}`}>
            X {health.xSession ? 'ready' : 'not logged in'}
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
            {activeJob.progress.errors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="layout">
        <aside>
          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>1. Collect</h2>
            <div className="field">
              <label>Time range</label>
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}>
                <option value="year">Past year</option>
                <option value="month">Past month</option>
                <option value="week">Past week</option>
              </select>
            </div>
            {(['reddit', 'google', 'x'] as Source[]).map((s) => (
              <div className="checkbox-row" key={s}>
                <input
                  type="checkbox"
                  checked={sources.includes(s)}
                  onChange={(e) =>
                    setSources((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                  }
                  id={`src-${s}`}
                />
                <label htmlFor={`src-${s}`}>
                  {SOURCE_LABELS[s]}
                  {s === 'x' && !health.xSession ? ' (login below)' : ''}
                </label>
              </div>
            ))}
            <button className="btn primary" disabled={searching || sources.length === 0} onClick={() => void handleSearch()}>
              {searching ? 'Searching…' : 'Start batch search'}
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
              CLI: <code>npm run search -- --sources reddit,google,x</code>
            </p>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>2. Export for LLM</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Copy or download the corpus (auto-tagged). Paste into Cursor / ChatGPT to find the best problems.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button className="btn primary small" onClick={() => void handleExport('compact', 'all')}>
                Copy all → LLM
              </button>
              <button className="btn small" onClick={() => void handleExport('compact', 'high-pain')}>
                Copy high-pain
              </button>
              <button className="btn small" onClick={() => void handleDownload('compact', 'all')}>
                Download .md
              </button>
              <button className="btn small" onClick={() => void handleDownload('json', 'all')}>
                Download .json
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0 }}>
              CLI: <code>npm run export</code> → writes <code>exports/</code>
            </p>
            {exportMsg && (
              <p style={{ fontSize: 12, color: 'var(--ok)', marginTop: 10, marginBottom: 0 }}>{exportMsg}</p>
            )}
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <h2>Corpus</h2>
            <div className="stats-grid">
              <div className="stat">
                <strong>{stats.total}</strong>
                <span>Total</span>
              </div>
              <div className="stat">
                <strong>{stats.highPain}</strong>
                <span>High-pain</span>
              </div>
              <div className="stat">
                <strong>{stats.bySource.reddit}</strong>
                <span>Reddit</span>
              </div>
              <div className="stat">
                <strong>{stats.bySource.google + stats.bySource.x}</strong>
                <span>Web + X</span>
              </div>
            </div>
            {stats.topCategories.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)' }}>
                {stats.topCategories.map(([cat, n]) => (
                  <li key={cat}>
                    {cat}: {n}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!health.xSession && (
            <div className="panel" style={{ marginBottom: 16 }}>
              <h2>X login (optional)</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px' }}>
                In Chrome on <strong>x.com</strong> while logged in: DevTools → Application → Cookies →{' '}
                <code>https://x.com</code>. Scroll until you find <code>auth_token</code> and <code>ct0</code> — not{' '}
                <code>__cf_bm</code> / <code>_cuid</code>.
              </p>
              <div className="field">
                <label>auth_token</label>
                <input value={xAuthToken} onChange={(e) => setXAuthToken(e.target.value)} placeholder="auth_token value" />
              </div>
              <div className="field">
                <label>ct0</label>
                <input value={xCt0} onChange={(e) => setXCt0(e.target.value)} placeholder="ct0 value" />
              </div>
              <button className="btn primary small" disabled={!xAuthToken || !xCt0} onClick={() => void handleSaveXSession()}>
                Save X session
              </button>
              {xMsg && <p style={{ fontSize: 12, color: 'var(--warn)', marginTop: 8, marginBottom: 0 }}>{xMsg}</p>}
            </div>
          )}

          <div className="panel">
            <h2>Queries</h2>
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
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="pain">Sort: pain signals</option>
              <option value="date">Sort: date</option>
              <option value="engagement">Sort: engagement</option>
            </select>
          </div>

          {loading ? (
            <div className="empty">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="empty">No posts yet. Run a batch search or <code>npm run search</code>.</div>
          ) : (
            <div className="post-list">
              {posts.map((post) => (
                <article key={post.id} className="post-card">
                  <div className="post-meta">
                    <span className={`badge ${post.source}`}>{SOURCE_LABELS[post.source]}</span>
                    <span className="badge">{CATEGORY_LABELS[post.primaryCategory]}</span>
                    {post.community && <span className="badge">{post.community}</span>}
                    {post.tags.includes('high-pain') && <span className="badge">high pain</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {formatDate(post.postedAt ?? post.fetchedAt)}
                    </span>
                  </div>
                  <h3 className="post-title">
                    <a href={post.url} target="_blank" rel="noreferrer">
                      {post.title}
                    </a>
                  </h3>
                  <p className="post-snippet">{post.snippet}</p>
                  <div className="post-actions">
                    <a className="btn small" href={post.url} target="_blank" rel="noreferrer">
                      Open
                    </a>
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
