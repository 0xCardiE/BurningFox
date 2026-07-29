/** Slippage shown as percent in settings (e.g. 5 = 5%). */
export const DEFAULT_SLIPPAGE_PERCENT = 5;

export const LIFI_INTEGRATOR_ID = '1337-wallet';

/** Compact mark for EIP-6963 / wallet discovery (keep small) — pixel "13/37" glyph. */
const L33T_ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='24' fill='%23050806'/><path fill='%2322c55e' d='M39 9h10v10h-10zM69 9h10v10h-10zM79 9h10v10h-10zM89 9h10v10h-10zM29 19h10v10h-10zM39 19h10v10h-10zM89 19h10v10h-10zM39 29h10v10h-10zM69 29h10v10h-10zM79 29h10v10h-10zM89 29h10v10h-10zM39 39h10v10h-10zM89 39h10v10h-10zM29 49h10v10h-10zM39 49h10v10h-10zM49 49h10v10h-10zM69 49h10v10h-10zM79 49h10v10h-10zM89 49h10v10h-10zM29 69h10v10h-10zM39 69h10v10h-10zM49 69h10v10h-10zM69 69h10v10h-10zM79 69h10v10h-10zM89 69h10v10h-10zM49 79h10v10h-10zM89 79h10v10h-10zM29 89h10v10h-10zM39 89h10v10h-10zM49 89h10v10h-10zM89 89h10v10h-10zM49 99h10v10h-10zM89 99h10v10h-10zM29 109h10v10h-10zM39 109h10v10h-10zM49 109h10v10h-10zM89 109h10v10h-10z'/></svg>";

export const L33T_PROVIDER_INFO = {
  uuid: 'l33t-dev-wallet-2026',
  name: '1337',
  icon: `data:image/svg+xml,${L33T_ICON_SVG}`,
  rdns: 'io.l33t.wallet',
} as const;

/** Default chain when no network is selected yet. */
export const DEFAULT_CHAIN_ID = 1;

/**
 * Fallback public RPC URLs per chain. Supplemented from {@link CHAIN_CATALOG} and
 * LiFi chain metadata ({@link mergeLifiChainRpcs}) at runtime.
 */
export const CHAIN_RPC_FALLBACK: Record<number, string[]> = {};
