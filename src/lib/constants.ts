import { L33T_ICON_DATA_URI } from './l33tProviderIcon.generated';

/** Slippage shown as percent in settings (e.g. 5 = 5%). */
export const DEFAULT_SLIPPAGE_PERCENT = 5;

export const LIFI_INTEGRATOR_ID = '1337-wallet';

export const L33T_PROVIDER_INFO = {
  uuid: 'l33t-dev-wallet-2026',
  name: '1337',
  icon: L33T_ICON_DATA_URI,
  rdns: 'io.l33t.wallet',
} as const;

/** Default chain when no network is selected yet. */
export const DEFAULT_CHAIN_ID = 1;

/**
 * Fallback public RPC URLs per chain. Supplemented from {@link CHAIN_CATALOG} and
 * LiFi chain metadata ({@link mergeLifiChainRpcs}) at runtime.
 */
export const CHAIN_RPC_FALLBACK: Record<number, string[]> = {};
