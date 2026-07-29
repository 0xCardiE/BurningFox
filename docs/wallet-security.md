# Wallet security model (1337 extension)

This note describes how signing works in 1337 and how to keep risk lower in practice. For a full **MetaMask vs 1337** comparison across vault crypto, session storage, auto-lock, dApp signing, and related topics, see **[wallet-comparison-metamask.md](./wallet-comparison-metamask.md)**.

## What the extension does today

- After unlock, the wallet uses a **local Viem account** (`PrivateKeyAccount`) to **sign transactions in extension code**.
- Signed txs are broadcast with **`eth_sendRawTransaction`** over your configured RPC (see `src/lib/ethereum.ts`).
- A full **EIP-1193 provider** is injected into pages (`window.ethereum`), with optional MetaMask replacement — see `src/inpage/provider.ts` and `src/lib/providerRpc.ts`.
- **Turbo mode (default):** dApp sign/send requests execute automatically while unlocked. **Normal mode:** each request is queued for approval in `TxApprovalSheet`.
- The unlocked **private key is kept for the browsing session** in the MV3 **service worker**, with a **plaintext copy in `chrome.storage.session`**, so the popup can close and reopen without re-entering the password (see `src/background.ts`). **Lock** or **auto-lock** clears that session.

Extension UI actions (swap, send, etc.) also sign via the unlocked account without a separate password prompt.

## Compared to MetaMask (short)

MetaMask’s main end-user advantage is **separation + explicit review**: the dapp is untrusted, and the wallet UI confirms every sign/send by default. 1337 defaults to **speed** — stay unlocked, persist session across UI close, and auto-sign dApp traffic in Turbo mode. Both are **hot software wallets**; see the [full comparison table](./wallet-comparison-metamask.md) for all 17 security topics.

## Remaining risks (even extension-only)

- **Bug or malicious dependency** in the extension build → code could exfiltrate the session key or sign malicious txs.
- **Compromised developer machine / supply chain** when building or installing the unpacked extension.
- **Physical access** to an **unlocked** browser profile → attacker may use the wallet until lock.
- **`<all_urls>` host permission** allows the extension to talk to any network endpoint you configure (needed for flexible RPC / APIs). That is **not** the same as injecting into every tab, but it means **trust your RPC and quote paths**; prefer reputable endpoints.

## Ways to keep risk lower (aligned with this codebase)

1. **Use Lock** when you step away; enable **auto-lock** (off by default) to a short idle time in settings.
2. Switch dApp mode to **Normal** if you want MetaMask-style per-request confirmation instead of Turbo auto-sign.
3. Use a **separate wallet** for experimental dapps or airdrop farming; treat this key as a **burner**.
4. **Install from a trustworthy build** (your own `npm run build`, signed distribution if you ship later—not a random repack).
5. For **large holdings**, use a **hardware wallet** or offline custody; this project’s model is convenience-first software custody.

## Related source files

- `src/lib/accountSession.ts` — in-memory account for the current UI context
- `src/lib/sessionBridge.ts` — sync with background session / lock
- `src/background.ts` — session persistence and auto-lock
- `src/lib/ethereum.ts` — sign + `eth_sendRawTransaction`
