/** Slippage shown as percent in settings (e.g. 5 = 5%). */
export const DEFAULT_SLIPPAGE_PERCENT = 5;

export const LIFI_INTEGRATOR_ID = 'burning-fox-extension';

/** Compact mark for EIP-6963 / wallet discovery (keep small). */
const BURNING_FOX_ICON_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' fill='none'><circle cx='64' cy='66' r='58' fill='%23FF8A3D' fill-opacity='.35'/><path d='M42 48c-2-14 4-26 10-32 1 8 4 14 8 18-8 2-14 8-18 14Z' fill='%23FF9A1A'/><path d='M64 6c-3 10-2 20 1 28 4-9 10-15 16-18-4 10-4 20-2 28C70 32 64 20 64 6Z' fill='%23FFB800'/><path d='M86 48c2-14-4-26-10-32-1 8-4 14-8 18 8 2 14 8 18 14Z' fill='%23FF9A1A'/><path d='M28 78c6-30 22-48 36-56 14 8 30 26 36 56-12 8-24 12-36 12S40 86 28 78Z' fill='%23FF7A1A'/><path d='M34 52 46 22l14 28c-8 2-16 6-26 2Z' fill='%23FF7A1A'/><path d='M94 52 82 22 68 50c8 2 16 6 26 2Z' fill='%23FF7A1A'/><path d='M40 48 48 30l8 18c-4 1-8 2-16 0Z' fill='%23FFD9A0'/><path d='M88 48 80 30l-8 18c4 1 8 2 16 0Z' fill='%23FFD9A0'/><ellipse cx='64' cy='86' rx='22' ry='16' fill='%23FFF3E0'/><ellipse cx='48' cy='66' rx='7' ry='9' fill='%231A0B08'/><ellipse cx='80' cy='66' rx='7' ry='9' fill='%231A0B08'/><path d='M64 78c-4.5 0-7.5 3-7.5 5.5 0 2.5 3.2 4.5 7.5 4.5s7.5-2 7.5-4.5C71.5 81 68.5 78 64 78Z' fill='%235C2410'/><path d='M56 92c3.5 4 6.5 5.5 8 5.5s4.5-1.5 8-5.5' stroke='%238B3A18' stroke-width='2.4' stroke-linecap='round'/></svg>";

export const BURNING_FOX_PROVIDER_INFO = {
  uuid: 'burning-fox-dev-wallet-2026',
  name: 'Burning Fox',
  icon: `data:image/svg+xml,${BURNING_FOX_ICON_SVG}`,
  rdns: 'io.burningfox.wallet',
} as const;

/** Default chain when no network is selected yet. */
export const DEFAULT_CHAIN_ID = 1;

/**
 * Fallback public RPC URLs per chain. Supplemented from {@link CHAIN_CATALOG} and
 * LiFi chain metadata ({@link mergeLifiChainRpcs}) at runtime.
 */
export const CHAIN_RPC_FALLBACK: Record<number, string[]> = {};
