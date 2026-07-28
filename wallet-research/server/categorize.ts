import type { Category } from './types.js';

interface CategoryRule {
  category: Category;
  keywords: string[];
  weight: number;
}

const RULES: CategoryRule[] = [
  {
    category: 'seed_recovery',
    keywords: ['seed phrase', 'recovery phrase', 'mnemonic', '12 words', '24 words', 'forgot password', 'backup phrase'],
    weight: 3,
  },
  {
    category: 'gas_fees',
    keywords: ['gas fee', 'gas too', 'high gas', 'gwei', 'transaction fee', 'insufficient funds for gas'],
    weight: 3,
  },
  {
    category: 'wrong_network',
    keywords: ['wrong network', 'wrong chain', 'wrong address', 'sent to wrong', 'bsc instead', 'polygon instead'],
    weight: 3,
  },
  {
    category: 'signing_approvals',
    keywords: ['blind signing', 'sign message', 'approval', 'permit', 'signature request', 'what am i signing', 'unlimited approval'],
    weight: 3,
  },
  {
    category: 'ui_confusion',
    keywords: ['confusing', 'confused', 'too hard', 'ui', 'ux', 'not intuitive', 'don\'t understand', 'how do i'],
    weight: 2,
  },
  {
    category: 'lost_funds',
    keywords: ['lost crypto', 'lost funds', 'lost money', 'stuck funds', 'missing funds', 'disappeared', 'accidentally sent'],
    weight: 3,
  },
  {
    category: 'switching_wallets',
    keywords: ['switched from', 'alternative', 'better wallet', 'moving to', 'migrating', 'replacing metamask'],
    weight: 2,
  },
  {
    category: 'hardware_wallet',
    keywords: ['ledger', 'trezor', 'hardware wallet', 'cold wallet', 'device not', 'connect ledger'],
    weight: 3,
  },
  {
    category: 'scam_security',
    keywords: ['scam', 'phishing', 'hacked', 'drainer', 'malicious', 'fake site', 'address poisoning', 'approve scam'],
    weight: 3,
  },
  {
    category: 'support',
    keywords: ['support', 'customer service', 'no response', 'ticket', 'help me', 'anyone know', 'how to fix'],
    weight: 1,
  },
  {
    category: 'swapping_bridging',
    keywords: ['swap', 'bridge', 'slippage', 'liquidity', 'cross chain', 'lifi', 'uniswap', 'exchange'],
    weight: 2,
  },
  {
    category: 'developer_integration',
    keywords: [
      'wagmi', 'viem', 'ethers', 'web3.js', 'walletconnect', 'reown', 'dapp', 'dapps',
      'hardhat', 'foundry', 'localhost', 'chainid', 'chain id', 'rpc', 'provider',
      'eip-712', 'typed data', 'siwe', 'sign-in with ethereum', 'window.ethereum',
      'injected provider', 'wallet adapter', 'sdk', 'integration', 'devnet', 'testnet',
      'simulate', 'nonce', 'contract wallet', 'account abstraction', 'erc-4337',
    ],
    weight: 2,
  },
];

export function categorizeText(title: string, snippet: string): { categories: Category[]; primaryCategory: Category } {
  const text = `${title} ${snippet}`.toLowerCase();
  const scores = new Map<Category, number>();

  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) score += rule.weight;
    }
    if (score > 0) scores.set(rule.category, score);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return { categories: ['other'], primaryCategory: 'other' };
  }

  const categories = ranked.slice(0, 3).map(([cat]) => cat);
  return { categories, primaryCategory: ranked[0][0] };
}

export function painScore(title: string, snippet: string): number {
  const text = `${title} ${snippet}`.toLowerCase();
  const painWords = [
    'frustrating', 'hate', 'broken', 'nightmare', 'lost', 'stuck', 'scam', 'confusing',
    'impossible', 'help', 'doesn\'t work', 'can\'t', 'cannot', 'wish', 'workaround', 'dealbreaker',
  ];
  return painWords.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);
}
