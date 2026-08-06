# 1337 Wallet (Chrome extension)

**1337** — developer EVM burner wallet. Create/import keys, swap via [LI.FI](https://li.fi), multi-send, RPC switcher, and MetaMask-compatible dapp connection. Styled after [1337 Skulls Wallet](https://chromewebstore.google.com/detail/1337-skulls-wallet/maggcienpliglmghmmfbnnmjclmopglk).

## Features

- **Multi-account** — seed-derived HD accounts and/or imported keys; pick the active account in the header
- **Seed phrase** — create or import BIP-39 (12–24 words), same path style as MetaMask (`m/44'/60'/0'/0/n`)
- **Private key** — generate or import a single hex key (burner-style)
- **Hardware wallets** — connect Ledger (WebHID) or Trezor Connect; sign txs on-device
- **Security docs** — [MetaMask comparison by wallet type](docs/wallet-comparison-metamask.md)
- **Swaps** — cross-chain token swaps powered by LI.FI
- **Multi-send** — paste a list of addresses and send native or ERC-20 to each (local key accounts)
- **Networks** — 20 popular chains with pre-filled public RPCs; switch endpoint from a dropdown
- **Dapp connect** — optional MetaMask drop-in (`window.ethereum`) for connecting to websites
- **UI** — opens in the **side panel** by default; switch to popup in Settings

## Development

```bash
npm install
npm run icons   # generate PNG icons from SVG
npm run build
```

Load the unpacked extension from `dist/` in Chrome (Developer mode → Load unpacked).

## Security

Local keys are for **developer/testing** use (password-encrypted vault in extension storage). Ledger/Trezor accounts keep private keys on the device. See [docs/wallet-security.md](docs/wallet-security.md) and [MetaMask comparison](docs/wallet-comparison-metamask.md).

## Wallet pain research tool

Separate local app for mining Reddit/X/Google for crypto wallet user complaints:

```bash
cd wallet-research && npm install && npm run dev
```

See [wallet-research/README.md](wallet-research/README.md).
