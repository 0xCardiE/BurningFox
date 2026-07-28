/**
 * Relevance gate: keep posts that look like crypto-wallet pain,
 * drop generic "problem/help/confusing" noise.
 */

const WALLET_ANCHORS = [
  'metamask',
  'phantom',
  'rabby',
  'rainbow wallet',
  'coinbase wallet',
  'trust wallet',
  'walletconnect',
  'reown',
  'wagmi',
  'viem',
  'ethers.js',
  'ethers ',
  'web3.js',
  'window.ethereum',
  'crypto wallet',
  'crypto wallets',
  'hardware wallet',
  'smart wallet',
  'contract wallet',
  'account abstraction',
  'erc-4337',
  'erc4337',
  'seed phrase',
  'recovery phrase',
  'mnemonic',
  'ledger',
  'trezor',
  'solana wallet',
  'ethereum wallet',
  'bitcoin wallet',
  'self-custody',
  'self custody',
  'blind signing',
  'gas fee',
  'gas fees',
  'wrong network',
  'wrong chain',
  'chain id',
  'chainid',
  'typed data',
  'eip-712',
  'eip712',
  'personal_sign',
  'siwe',
  'sign-in with ethereum',
  'injected provider',
  'wallet adapter',
  'dapp',
  'defi wallet',
  'hot wallet',
  'cold wallet',
  'browser wallet',
  'extension wallet',
];

const CRYPTO_CONTEXT = [
  'crypto',
  'ethereum',
  'bitcoin',
  'solana',
  'web3',
  'defi',
  'blockchain',
  'nft',
  'token',
  'on-chain',
  'onchain',
  'eth ',
  'btc ',
  'usdc',
  'usdt',
];

const PAIN_SIGNALS = [
  'frustrat',
  'confus',
  'stuck',
  'broken',
  'nightmare',
  'hate',
  'scam',
  'phish',
  'hacked',
  'drainer',
  'lost funds',
  'lost crypto',
  'lost money',
  'missing funds',
  "can't send",
  'cant send',
  'cannot send',
  "doesn't work",
  'doesnt work',
  'not working',
  'failed',
  'failing',
  'error',
  'issue',
  'problem',
  'help',
  'unable',
  'impossible',
  'wish',
  'workaround',
  'dealbreaker',
  'pending forever',
  'too hard',
  'too confusing',
  'how do i',
  'how to',
  'why is',
  'wrong address',
  'sent to wrong',
  'accidentally sent',
  'approval',
  'signing',
  'signature',
  'connect',
  'integration',
  'integrate',
  'rpc',
  'revert',
  'simulate',
  'debug',
  'support',
];

/** Seeds Arctic Shift must always prefer — never bare "help"/"problem" alone */
export const WALLET_SEED_PREFERRED = [
  'metamask',
  'phantom',
  'wallet',
  'walletconnect',
  'wagmi',
  'viem',
  'ledger',
  'trezor',
  'seed',
  'gas',
  'signing',
  'approval',
  'bridge',
  'swap',
  'localhost',
  'rpc',
  'chainid',
] as const;

export function hasWalletAnchor(text: string): boolean {
  const t = text.toLowerCase();
  if (WALLET_ANCHORS.some((a) => t.includes(a))) return true;
  // Bare "wallet" only counts with crypto context nearby
  if (/\bwallet(s)?\b/i.test(t) && CRYPTO_CONTEXT.some((c) => t.includes(c))) return true;
  return false;
}

export function hasPainSignal(text: string): boolean {
  const t = text.toLowerCase();
  return PAIN_SIGNALS.some((a) => t.includes(a));
}

/**
 * True if the post is likely about crypto wallet UX / developer wallet pain.
 * Requires a wallet/crypto-wallet anchor AND pain language.
 */
export function isWalletRelevant(title: string, snippet: string): boolean {
  const text = `${title} ${snippet}`;
  return hasWalletAnchor(text) && hasPainSignal(text);
}
