# BurnBox (Chrome extension)

Developer EVM burner wallet — create/import keys, swap via [LI.FI](https://li.fi), multi-send, RPC switcher, and MetaMask-compatible dapp connection.

## Features

- **Burner wallet** — generate or import a private key for testing (password encrypts local vault only)
- **Swaps** — cross-chain token swaps powered by LI.FI
- **Multi-send** — paste a list of addresses and send native or ERC-20 to each
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

This is a **developer/testing wallet**, not a secure hardware-backed wallet. See [docs/wallet-security.md](docs/wallet-security.md).

## Wallet pain research tool

Separate local app for mining Reddit/X/Google for crypto wallet user complaints:

```bash
cd wallet-research && npm install && npm run dev
```

See [wallet-research/README.md](wallet-research/README.md).
