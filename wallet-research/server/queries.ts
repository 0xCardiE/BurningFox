import type { SearchQuery } from './types.js';

/**
 * Default search queries.
 * - Reddit/Google use full boolean `query`.
 * - X uses `xQuery` when present (tight phrases); otherwise X is omitted from sources
 *   for broad/noisy queries.
 */
export const DEFAULT_QUERIES: SearchQuery[] = [
  {
    id: 'wallet-confusion',
    label: 'Wallet confusion',
    query: '("crypto wallet" OR MetaMask OR Phantom) (confusing OR frustrating OR "too hard")',
    xQuery: '(MetaMask OR Phantom OR "crypto wallet") (confusing OR frustrating OR "too hard") -is:retweet lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'cant-send',
    label: "Can't send / stuck tx",
    query: '(MetaMask OR Phantom OR "crypto wallet") ("can\'t send" OR "stuck" OR "pending forever" OR failed)',
    xQuery: '(MetaMask OR Phantom) ("can\'t send" OR stuck OR "pending forever" OR "tx failed") lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'wrong-network',
    label: 'Wrong network',
    query: '("wrong network" OR "wrong chain" OR "sent to wrong") crypto wallet',
    xQuery: '(MetaMask OR wallet) ("wrong network" OR "wrong chain" OR "sent to wrong") lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'seed-phrase',
    label: 'Seed phrase problems',
    query: '("seed phrase" OR "recovery phrase") (lost OR forgot OR backup OR "can\'t recover") wallet',
    xQuery: '("seed phrase" OR "recovery phrase") (lost OR forgot OR backup OR recover) (MetaMask OR wallet) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'gas-fees',
    label: 'Gas fee pain',
    query: '(MetaMask OR "crypto wallet") ("gas fee" OR "gas too high" OR "why is gas")',
    xQuery: '(MetaMask OR "gas fee") ("too high" OR expensive OR confusing) wallet lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'signing-blind',
    label: 'Signing & blind signing',
    query: '("blind signing" OR "sign message" OR approval) wallet (scary OR confusing OR "what am I signing")',
    xQuery: '("blind signing" OR "what am I signing" OR "unlimited approval") (MetaMask OR wallet) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'switching-wallets',
    label: 'Switching wallets',
    query: '("switched from MetaMask" OR "MetaMask alternative" OR "better wallet than") crypto',
    xQuery: '("switched from MetaMask" OR "MetaMask alternative" OR "better than MetaMask") lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'lost-funds',
    label: 'Lost funds',
    query: '("lost crypto" OR "lost funds" OR "accidentally sent") (MetaMask OR Phantom OR "crypto wallet")',
    xQuery: '(MetaMask OR Phantom OR "crypto wallet") ("lost funds" OR "lost crypto" OR "accidentally sent") lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'hardware-wallet',
    label: 'Hardware wallet issues',
    query: '(Ledger OR Trezor) (wallet OR MetaMask) (problem OR issue OR "doesn\'t work" OR connect)',
    xQuery: '(Ledger OR Trezor) (MetaMask OR connect OR "doesn\'t work" OR broken) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'reddit-metamask',
    label: 'Reddit r/MetaMask complaints',
    query: 'subreddit:Metamask (help OR problem OR hate OR frustrating OR "doesn\'t work")',
    sources: ['reddit'],
    enabled: true,
  },
  {
    id: 'reddit-beginners',
    label: 'Reddit beginners wallet help',
    query: 'subreddit:BitcoinBeginners (wallet OR MetaMask) (safe OR confused OR help OR recommend OR lost)',
    sources: ['reddit'],
    enabled: true,
  },
  {
    id: 'google-reddit-site',
    label: 'Google: Reddit wallet pain',
    query: 'site:reddit.com ("crypto wallet" OR MetaMask) (frustrating OR confusing OR "wish" OR workaround)',
    sources: ['google'],
    enabled: true,
  },
  // --- Developer / dApp builder pain ---
  {
    id: 'dev-wallet-connect',
    label: 'Dev: wallet connect & SDK',
    query: '(wagmi OR viem OR ethers OR WalletConnect OR Reown) (wallet OR MetaMask) (issue OR error OR broken OR "doesn\'t work" OR frustrating)',
    xQuery: '(wagmi OR viem OR WalletConnect) (MetaMask OR wallet) (error OR broken OR frustrating) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'dev-dapp-metamask',
    label: 'Dev: MetaMask dApp integration',
    query: '(dapp OR dApp OR "decentralized app") MetaMask (connect OR integration OR provider) (problem OR error OR help OR failing)',
    xQuery: 'MetaMask (dapp OR "dApp") (connect OR integration OR provider) (error OR failing OR broken) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'dev-localhost-testing',
    label: 'Dev: local testing & localhost',
    query: '(MetaMask OR wallet OR Hardhat OR Foundry) (localhost OR "local network" OR testnet) (not working OR error OR connect OR RPC)',
    // Broad OR soup blows up on X — Reddit/Google only
    sources: ['reddit', 'google'],
    enabled: true,
  },
  {
    id: 'dev-signing-typed-data',
    label: 'Dev: signing & typed data',
    query: '(EIP-712 OR "typed data" OR SIWE OR "sign message" OR personal_sign) (wallet OR MetaMask OR viem) (error OR fail OR confusing OR broken)',
    xQuery: '(EIP-712 OR "typed data" OR SIWE OR personal_sign) (MetaMask OR viem) (error OR fail OR broken) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'dev-chain-rpc',
    label: 'Dev: chain ID & RPC errors',
    query: '(chainId OR "chain id" OR "wrong network" OR RPC) (wallet OR MetaMask OR wagmi) (developer OR dapp OR integration OR error)',
    xQuery: '(MetaMask OR wagmi) (chainId OR "wrong network" OR RPC) (error OR broken) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'dev-tx-simulation',
    label: 'Dev: tx simulation & debugging',
    query: '(simulate OR simulation OR "transaction failed" OR revert) (wallet OR MetaMask OR viem OR ethers) (dapp OR developer OR debug)',
    sources: ['reddit', 'google'],
    enabled: true,
  },
  {
    id: 'dev-account-abstraction',
    label: 'Dev: smart / AA wallets',
    query: '("account abstraction" OR ERC-4337 OR "smart wallet" OR "contract wallet") (developer OR integrate OR SDK OR pain OR problem)',
    xQuery: '("account abstraction" OR ERC-4337 OR "smart wallet") (SDK OR integrate OR pain OR problem) lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'dev-phantom-solana',
    label: 'Dev: Phantom / Solana wallet',
    query: '(Phantom OR "Solana wallet") (developer OR dapp OR integrate OR adapter) (error OR issue OR broken OR frustrating)',
    xQuery: 'Phantom (dapp OR adapter OR integrate) (error OR broken OR frustrating) Solana lang:en',
    sources: ['reddit', 'google', 'x'],
    enabled: true,
  },
  {
    id: 'reddit-ethdev',
    label: 'Dev: r/ethdev wallet threads',
    query: 'subreddit:ethdev (MetaMask OR wallet OR wagmi OR WalletConnect OR viem) (problem OR help OR error OR frustrating)',
    sources: ['reddit'],
    enabled: true,
  },
  {
    id: 'reddit-solidity',
    label: 'Dev: r/solidity wallet threads',
    query: 'subreddit:solidity (wallet OR MetaMask OR signing OR provider) (issue OR help OR error OR integrate)',
    sources: ['reddit'],
    enabled: true,
  },
  {
    id: 'reddit-web3',
    label: 'Dev: r/web3 wallet threads',
    query: 'subreddit:web3 (wallet OR MetaMask OR connect OR WalletConnect) (problem OR broken OR frustrating OR help)',
    sources: ['reddit'],
    enabled: true,
  },
  {
    id: 'google-dev-wallet',
    label: 'Dev: Google dev wallet pain',
    query: 'site:reddit.com OR site:stackoverflow.com (wagmi OR viem OR WalletConnect) wallet (error OR frustrating OR "doesn\'t work")',
    sources: ['google'],
    enabled: true,
  },
];

export const REDDIT_SUBREDDITS = [
  'ethdev',
  'solidity',
  'web3',
  'ethereum',
  'Metamask',
  'defi',
  'solana',
  'CryptoCurrency',
  'BitcoinBeginners',
  'ledgerwallet',
  'TREZOR',
];

/** Subreddits scanned during bonus passes — lowercase for Arctic Shift */
export const DEV_SUBREDDITS = ['ethdev', 'solidity', 'web3'];
