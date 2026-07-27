# Wallet security model (Jumpa extension)

This note describes how signing works in Jumpa, how that compares to MetaMask, and what changes when **everything runs inside the extension** (no ordinary website holding your keys).

## What the extension does today

- After unlock, the wallet uses a **local Viem account** (`PrivateKeyAccount`) to **sign transactions in extension code**.
- Signed txs are broadcast with **`eth_sendRawTransaction`** over your configured RPC (see `src/lib/ethereum.ts`).
- There is **no injected provider** and **no wallet connection flow** to random dapps: actions are initiated from the extension UI (popup / side panel).
- The unlocked **private key is kept for the browsing session** in the MV3 **service worker**, with a copy in **`chrome.storage.session`**, so the popup can close and reopen without re-entering the key (see `src/background.ts` header comment and `SESSION_KEY`). **Lock** or **auto-lock** clears that session.

So each swap is still “sign + send,” but the **approval UX is “already unlocked”**, not a separate MetaMask confirmation sheet every time.

## Compared to MetaMask (typical dapp flow)

| Aspect | Jumpa (this extension) | MetaMask (typical) |
|--------|------------------------|---------------------|
| Where the key lives | Extension: UI + service worker / `chrome.storage.session` while unlocked | Extension: isolated vault; dapp never holds the key |
| Who signs | Our code calls `signTransaction` after unlock | User confirms in wallet UI; extension signs |
| Per-tx human gate | Optional: lock / re-unlock; otherwise one tap after unlock | Usually one confirmation per operation |
| Random website attack surface | **Not** exposing keys to page JS if you only use the extension UI and don’t inject keys into pages | Dapp prompts MetaMask; user reviews in wallet UI |

**Summary:** MetaMask’s main security advantage for end users is **separation + explicit review**: the dapp is untrusted, and the wallet UI is the gate. Jumpa is closer to a **hot wallet inside the extension**: fast UX, but after unlock, **code that runs in the extension context can sign on your behalf** until you lock or auto-lock.

## Extension-only usage: what gets better

If you **do not** use this key for normal website interactions (no pasting the key on a site, no third-party dapp connecting to this wallet):

- You avoid the classic **`window.ethereum` / WalletConnect + malicious dapp** class of attacks against *this* key.
- Your signing surface is **your extension package + Chrome + dependencies**, not every origin you visit.
- Manifest uses **extension page CSP** (`script-src 'self'` in `public/manifest.json`), which limits remote script injection into extension pages (does not remove all bugs; it raises the bar).

That is meaningfully **safer than “key in a normal webpage”** or “approve every site.” It does **not** make the key cold storage: it remains a **hot, software-held key** in the browser.

## Remaining risks (even extension-only)

- **Bug or malicious dependency** in the extension build → code could exfiltrate the session key or sign malicious txs.
- **Compromised developer machine / supply chain** when building or installing the unpacked extension.
- **Physical access** to an **unlocked** browser profile → attacker may use the wallet until lock.
- **`<all_urls>` host permission** allows the extension to talk to any network endpoint you configure (needed for flexible RPC / APIs). That is **not** the same as injecting into every tab, but it means **trust your RPC and quote paths**; prefer reputable endpoints.

## Ways to keep risk lower (aligned with this codebase)

1. **Use Lock** when you step away; set **auto-lock** to a short idle time in settings (background clears session storage on expiry).
2. **Keep usage scoped to this extension** only; use a **separate wallet** for experimental dapps or airdrop farming.
3. **Avoid adding content scripts** that forward keys or signing to arbitrary pages; keep signing in extension surfaces only.
4. **Install from a trustworthy build** (your own `npm run build`, signed distribution if you ship later—not a random repack).
5. For **large holdings**, use a **hardware wallet** or offline custody; this project’s model is convenience-first software custody.

## Related source files

- `src/lib/accountSession.ts` — in-memory account for the current UI context
- `src/lib/sessionBridge.ts` — sync with background session / lock
- `src/background.ts` — session persistence and auto-lock
- `src/lib/ethereum.ts` — sign + `eth_sendRawTransaction`
