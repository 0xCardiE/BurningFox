# Wallet Pain Research

Local research tool for mining crypto wallet complaints from **Reddit**, **Google/web**, and **X**.

Results and your ratings are stored locally in `wallet-research/data/store.json`.

## Quick start

```bash
cd wallet-research
npm install
npm run dev
```

Open http://localhost:5174

The UI talks to the API on http://localhost:3847 (proxied in dev).

## What it does

1. Runs a **batch search** across enabled query templates (wallet confusion, wrong network, seed phrase, gas fees, etc.)
2. Fetches results **slowly** with configurable delays to reduce rate limiting
3. **Auto-categorizes** posts (seed recovery, gas fees, UI confusion, lost funds, etc.)
4. Lets you mark posts as **useful / not useful** and add notes — all saved locally

## Sources

### Reddit (works out of the box)

Uses [Arctic Shift](https://arctic-shift.photon-reddit.com) — a free historical Reddit archive API — to search wallet-related subreddits up to ~1 year back. No API key required.

**Optional:** set official Reddit OAuth for live search (may require app approval):

```bash
export REDDIT_CLIENT_ID=your_app_id
export REDDIT_CLIENT_SECRET=your_secret
```

Create an app at https://www.reddit.com/prefs/apps (script type).

### Google / web (works out of the box)

Uses DuckDuckGo HTML search by default, biased toward Reddit/X/help forums.

**Optional:** set Google Custom Search for better results (100 free queries/day):

```bash
export GOOGLE_API_KEY=your_key
export GOOGLE_CX=your_search_engine_id
```

### X / Twitter (optional, requires login)

X blocks anonymous search. This app uses **Playwright** with a saved browser session (same approach as tools like api-god-x).

One-time setup:

```bash
npx playwright install chromium
npm run x:login
```

Log in to X in the browser window, then press **Enter** in the terminal. Session is saved to `data/x-session.json`.

Then enable **X** in the UI when running a search.

> Use a secondary X account if you're worried about automation flags.

## CLI batch search

```bash
npm run search
```

Runs the same job runner headlessly (uses default enabled queries).

## Data

| File | Purpose |
|------|---------|
| `data/store.json` | All posts, jobs, ratings, notes |
| `data/x-session.json` | X login session (gitignored) |

## Customizing queries

Edit `server/queries.ts` to add/remove search templates. Toggle them on/off in the UI sidebar.

## Architecture

```
wallet-research/
  server/           Express API + search runners
  src/              React UI
  data/             Local JSON storage
```

## Limitations

- Reddit/X may rate-limit or block aggressive use — keep default delays
- X internal GraphQL can break when X changes endpoints; re-run `npm run x:login` if search fails
- Categorization is keyword-based, not LLM — good enough for triage, not perfect taxonomy
- Google via DuckDuckGo is approximate; use Google CSE for production research
