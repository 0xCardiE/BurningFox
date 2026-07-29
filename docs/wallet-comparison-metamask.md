# Security comparison: MetaMask vs 1337

Side-by-side view of how **MetaMask** (typical browser-extension hot wallet) compares to **1337** (this project — a developer burner wallet). Both are software hot wallets; neither is cold or hardware custody.

Sources for 1337: `src/lib/vault.ts`, `src/background.ts`, `src/lib/sessionBridge.ts`, `src/lib/providerRpc.ts`, `src/lib/storageState.ts`, `public/manifest.json`.

---

## Comparison table

| Topic | MetaMask (hot) | 1337 (hot) |
|-------|----------------|---------------|
| **Wallet type** | Software key in browser extension | Software key in Chrome MV3 extension (single EVM private key, not HD/mnemonic) |
| **Key at rest** | Password-encrypted vault in browser storage | Password-encrypted vault in `chrome.storage.local` (`leet_wallet_v1`) |
| **Vault crypto** | PBKDF2 / scrypt-style KDF + symmetric encryption | PBKDF2 (210k iterations, SHA-256) + AES-GCM-256 |
| **While unlocked** | Decrypted key in extension memory | Decrypted key in service worker memory, popup memory, **and** plaintext hex in `chrome.storage.session` |
| **Session persistence** | Stays unlocked after closing the UI (until lock or auto-lock) | Same — session held in MV3 service worker + session storage across popup/side-panel close |
| **Session on disk** | Typically memory-only while unlocked | **Plaintext private key** in `chrome.storage.session` (`l33t_session_pk`) plus in-memory copies |
| **Unlock** | Password once per session | Password once per session (decrypt vault → push key to background session) |
| **Auto-lock** | Optional user setting | Optional user setting; **default off** (choices: off, 5, 15, 30, 60 min idle) |
| **Explicit lock** | Yes | Yes (Settings → Lock; clears session everywhere) |
| **Approve before sign** | Yes — per tx / sign request | **Configurable:** default **Turbo** auto-signs when unlocked; **Normal** mode queues per-request approval (`TxApprovalSheet`) |
| **Password per action** | No (while unlocked) | No (while unlocked) |
| **Websites can request signatures** | Yes (`window.ethereum`) | Yes — full EIP-1193 provider injected; can replace MetaMask on pages (`replaceMetaMask`, default on) |
| **Offline vault attack** | Encrypted vault can be password-guessed | Same — offline dump of `chrome.storage.local` yields ciphertext; attacker must brute-force password |
| **Unlocked + malware** | Key usable from memory | Key usable from memory **and** readable from session storage; Turbo mode allows auto-signed dApp requests |
| **Close UI = locked?** | No | No |
| **Browser restart** | Session cleared; vault remains | Session cleared; encrypted vault + settings remain in `chrome.storage.local` |
| **Fundamental security class** | Hot software wallet | Hot software wallet (explicitly scoped as a developer burner — not for securing real funds) |

---

## Topic notes

### Wallet type

Both are browser-extension hot wallets. MetaMask is a general-purpose HD wallet (seed phrase, multiple accounts). 1337 stores a **single imported/generated private key** — simpler model, no BIP-39 recovery phrase in this codebase.

### Key at rest & vault crypto

Both encrypt the vault with a user password before writing to durable browser storage. 1337’s parameters are fixed and visible in code:

- PBKDF2: 210,000 iterations, SHA-256
- AES-GCM-256 with random 16-byte salt and 12-byte IV
- Minimum password length: 8 characters

MetaMask uses a similar class of KDF + symmetric encryption (exact iteration counts vary by version). The practical offline attack surface is the same: **encrypted blob + password guessing**.

### While unlocked & session on disk

This is the largest architectural difference.

| | MetaMask | 1337 |
|---|----------|---------|
| In-memory key | Yes | Yes (service worker + popup) |
| Encrypted session blob on disk while unlocked | Typically no | **No encryption** — full hex private key in `chrome.storage.session` |

If malware or another compromised extension can read session storage for this extension profile, 1337 exposes the raw key without re-entering the password. MetaMask generally keeps the decrypted key in extension memory only while unlocked.

### Session persistence & close UI

Neither wallet locks when you close the popup. 1337 relies on the MV3 service worker to keep the session alive so reopening the side panel does not require unlock. Lock, auto-lock expiry, wipe, or browser restart end the session.

### Auto-lock

MetaMask offers optional idle auto-lock. 1337 also offers it but ships with **auto-lock disabled by default** — a convenience-first default for a burner/dev wallet. When enabled, idle time is tracked via activity pings from the wallet UI and content script (dApp RPC activity alone does not reset the timer).

### Approve before sign

MetaMask’s default UX is **always confirm** in the wallet UI before signing.

1337 defaults to **Turbo** (`txConfirmMode: 'speed'`): when unlocked, dApp signing methods (`eth_sendTransaction`, `personal_sign`, `eth_sign`, typed data variants) execute immediately without a confirmation sheet. Switching to **Normal** mode queues each request for explicit approval in `TxApprovalSheet`.

Internal extension actions (swap, multi-send, gas station, etc.) sign directly via the unlocked account — they do not go through the dApp approval queue regardless of mode.

### Websites can request signatures

Both expose `window.ethereum` to web pages. 1337 injects a full EIP-1193 provider (`src/inpage/provider.ts` → content script → background `PROVIDER_RPC`). By default it can replace MetaMask as `window.ethereum`.

Connection model: `eth_requestAccounts` auto-connects the origin when the wallet is unlocked; users can also connect manually from the wallet UI.

### Offline vault attack

Attacker with a copy of locked storage gets an encrypted vault. Security reduces to password strength and KDF cost. 1337 uses 210k PBKDF2 iterations — reasonable but not hardware-wallet grade.

**Additional 1337 risk:** if the attacker has an **unlocked** browser profile (live session or `chrome.storage.session` dump before restart), they get the plaintext key without the password.

### Unlocked + malware

Both wallets are fully compromised while unlocked if hostile code runs with extension privileges or can read extension memory/storage.

1337 adds:

- Plaintext session key in `chrome.storage.session`
- Default Turbo auto-sign for dApp requests
- `<all_urls>` host permission for RPC/API calls (needed for flexible endpoints — trust your RPC and quote sources)

### Browser restart

`chrome.storage.session` is cleared when the browser exits. The encrypted vault in `chrome.storage.local` persists. User must unlock again. Connected dApp origins (also session-scoped) are lost on restart.

---

## Summary

| Dimension | MetaMask | 1337 |
|-----------|----------|---------|
| Custody class | Hot software wallet | Hot software wallet (burner / dev scope) |
| Vault encryption | Strong, industry-standard pattern | Strong, explicit PBKDF2 + AES-GCM |
| Unlocked session on disk | Usually memory-only | **Plaintext key in session storage** |
| Default signing UX | Confirm every request | **Auto-sign when unlocked (Turbo)** |
| dApp bridge | Yes | Yes (can replace MetaMask) |
| Auto-lock default | User-configured | **Off by default** |
| Intended use | General-purpose self-custody | Fast dev/burner workflows — not for large holdings |

1337 trades MetaMask’s **separation + explicit review** defaults for **speed**: stay unlocked, auto-sign dApp traffic in Turbo mode, and persist the session across UI closes. That is appropriate for a labeled burner wallet only if users understand they are accepting hot-wallet risk with a weaker unlocked-state model than MetaMask.

For material funds: use MetaMask (or similar) with confirmations enabled, a hardware wallet, or offline custody — not 1337 defaults.

---

## Related docs & source

- [Wallet security model](./wallet-security.md) — operational risks and mitigations
- `src/lib/vault.ts` — vault encryption
- `src/background.ts` — session persistence, auto-lock
- `src/lib/providerRpc.ts` — dApp RPC and Turbo vs Normal signing
- `src/ui/TxApprovalSheet.tsx` — Normal-mode approval UI
- `src/ui/SettingsView.tsx` — lock, auto-lock, storage explanation
