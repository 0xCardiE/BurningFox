/** Slippage shown as percent in settings (e.g. 5 = 5%). */
export const DEFAULT_SLIPPAGE_PERCENT = 5;

export const LIFI_INTEGRATOR_ID = 'burnbox-extension';

/** Compact mark for EIP-6963 / wallet discovery (keep small). */
const BURNBOX_ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' fill='none'><circle cx='64' cy='70' r='56' fill='%23FF8A3D' fill-opacity='.35'/><path d='M40 52c-2-16 5-28 12-34 1 9 4 15 8 19-8 2-14 8-20 15Z' fill='%23FF9A1A'/><path d='M64 4c-3 11-2 22 1 30 4-10 10-16 16-19-4 11-4 22-2 30C70 32 64 18 64 4Z' fill='%23FFB800'/><path d='M88 52c2-16-5-28-12-34-1 9-4 15-8 19 8 2 14 8 20 15Z' fill='%23FF9A1A'/><path d='M30 56h68v48c0 6-5 10-11 10H41c-6 0-11-4-11-10V56Z' fill='%23FF7A1A'/><path d='M28 56c2-10 10-16 18-18l42-6c8-1 16 4 18 14L98 56H30Z' fill='%23FFB14A'/><ellipse cx='64' cy='78' rx='22' ry='14' fill='%23FFF3E0' fill-opacity='.85'/><rect x='46' y='86' width='36' height='8' rx='3' fill='%23FFF3E0' fill-opacity='.35'/></svg>";

export const BURNBOX_PROVIDER_INFO = {
  uuid: 'burnbox-dev-wallet-2026',
  name: 'BurnBox',
  icon: `data:image/svg+xml,${BURNBOX_ICON_SVG}`,
  rdns: 'io.burnbox.wallet',
} as const;

/** @deprecated Use BURNBOX_PROVIDER_INFO */
export const BURNING_FOX_PROVIDER_INFO = BURNBOX_PROVIDER_INFO;

/** Default chain when no network is selected yet. */
export const DEFAULT_CHAIN_ID = 1;

/**
 * Fallback public RPC URLs per chain. Supplemented from {@link CHAIN_CATALOG} and
 * LiFi chain metadata ({@link mergeLifiChainRpcs}) at runtime.
 */
export const CHAIN_RPC_FALLBACK: Record<number, string[]> = {};
