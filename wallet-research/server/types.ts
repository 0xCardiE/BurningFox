export type Source = 'reddit' | 'x' | 'google';

export type Category =
  | 'seed_recovery'
  | 'gas_fees'
  | 'wrong_network'
  | 'signing_approvals'
  | 'ui_confusion'
  | 'lost_funds'
  | 'switching_wallets'
  | 'hardware_wallet'
  | 'scam_security'
  | 'support'
  | 'swapping_bridging'
  | 'developer_integration'
  | 'other';

export type Rating = 'useful' | 'not_useful' | 'unrated';

export interface ResearchPost {
  id: string;
  source: Source;
  title: string;
  snippet: string;
  url: string;
  author?: string;
  community?: string;
  postedAt?: string;
  query: string;
  categories: Category[];
  primaryCategory: Category;
  engagement?: {
    score?: number;
    comments?: number;
    likes?: number;
  };
  rating: Rating;
  notes: string;
  tags: string[];
  fetchedAt: string;
  jobId?: string;
}

export interface SearchQuery {
  id: string;
  label: string;
  query: string;
  sources: Source[];
  enabled: boolean;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SearchJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  timeRange: 'year' | 'month' | 'week';
  sources: Source[];
  queryIds: string[];
  progress: {
    totalSteps: number;
    completedSteps: number;
    currentStep?: string;
    postsFound: number;
    errors: string[];
  };
}

export interface AppData {
  posts: ResearchPost[];
  jobs: SearchJob[];
  queries: SearchQuery[];
  settings: {
    delayMs: number;
    maxPagesPerQuery: number;
  };
}

export const CATEGORY_LABELS: Record<Category, string> = {
  seed_recovery: 'Seed phrase & recovery',
  gas_fees: 'Gas fees',
  wrong_network: 'Wrong network / chain',
  signing_approvals: 'Signing & approvals',
  ui_confusion: 'UI confusion',
  lost_funds: 'Lost / stuck funds',
  switching_wallets: 'Switching wallets',
  hardware_wallet: 'Hardware wallet',
  scam_security: 'Scams & security',
  support: 'Support & help',
  swapping_bridging: 'Swap & bridge',
  developer_integration: 'Developer & dApp integration',
  other: 'Other',
};

export const SOURCE_LABELS: Record<Source, string> = {
  reddit: 'Reddit',
  x: 'X',
  google: 'Google',
};
