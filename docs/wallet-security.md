# Wallet security model (BurnBox extension)

This note describes how signing works in BurnBox and how to keep risk lower in practice. For a full comparison of **all account types vs MetaMask equivalents**, see **[wallet-comparison-metamask.md](./wallet-comparison-metamask.md)**.

## What the extension does today

- **Local accounts** — BIP-39 seed (create/import) and/or hex private keys, encrypted in the vault (`src/lib/vault.ts`). Seed wallets can derive more HD accounts (`m/44'/60'/0'/0/n`).
- **Hardware accounts** — Ledger (WebHID) and Trezor Connect; only address + path are stored. Signing uses the device SDK.
- After unlock, local signing uses a **Viem account** and **`eth_sendRawTransaction`** over your RPC (`src/lib/ethereum.ts`).
- A full **EIP-1193 provider** is injected (`window.ethereum`), with optional MetaMask replacement.
- **Turbo mode (default):** dApp sign/send requests execute automatically while a **local** account is unlocked. **Normal mode:** each request is queued in `TxApprovalSheet`. **Hardware** always requires device confirmation (and UI approval for dApp txs).
- The unlocked **active private key** (local only) is kept in the MV3 **service worker** and as **plaintext in `chrome.storage.session`**. Seed phrase (if any) stays in UI memory for the unlock session, not in session storage. **Lock** / **auto-lock** clears the session.

## Compared to MetaMask (short)

| | MetaMask | BurnBox |
|---|----------|---------|
| Software default | Confirm every request | Turbo auto-sign |
| HD seed | Yes (SRP) | Yes (optional; create default) |
| Private key import | Yes | Yes |
| Hardware | Ledger / Trezor | Ledger / Trezor |
| Unlocked PK on disk | Typically memory-only | Active PK in `chrome.storage.session` |

See the [full multi-type table](./wallet-comparison-metamask.md).

## Remaining risks (even extension-only)

- **Bug or malicious dependency** → exfiltrate session key / mnemonic from memory or sign malicious txs.
- **Compromised developer machine / supply chain** when building or installing the unpacked extension.
- **Physical access** to an **unlocked** browser profile → attacker may use local accounts until lock; hardware still needs the device.
- **`<all_urls>` host permission** — trust your RPC and quote paths.

## Ways to keep risk lower

1. **Use Lock** when you step away; enable **auto-lock** (off by default).
2. Switch dApp mode to **Normal** for MetaMask-style per-request confirmation.
3. Prefer **Ledger/Trezor** for anything beyond burner balances.
4. Back up **seed phrases** offline; never paste them into websites.
5. **Install from a trustworthy build** (`npm run build` from this repo).

## Related source files

- `src/lib/walletCore.ts` — seed + private key parsing/derivation
- `src/lib/walletManager.ts` — account lifecycle
- `src/lib/accountSession.ts` — in-memory session
- `src/lib/sessionBridge.ts` / `src/background.ts` — background session / lock
- `src/lib/ledger.ts` / `src/lib/trezor.ts` — hardware signing
