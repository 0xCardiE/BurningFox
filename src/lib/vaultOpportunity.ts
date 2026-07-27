/**
 * Normalized yield row for UI + future execution adapters.
 * Discovery fields come from DefiLlama; vault/adapter details may be filled later
 * (e.g. ready-to-sign payloads from something like the Vaults.fyi transactions API).
 */
export type VaultOpportunity = {
  id: string;
  /** DefiLlama yields `project` slug; used to resolve protocol metadata. */
  projectSlug: string;
  protocol: string;
  protocolLogo: string;
  chain: string;
  /** Token(s) you deposit — from yields `symbol`. */
  asset: string;
  assetAddress: string;
  vaultAddress: string;
  apy: number;
  apyBase?: number;
  apyReward?: number;
  tvlUsd: number;
  /** DefiLlama protocol category when available (e.g. Lending, Yield Aggregator). */
  protocolCategory?: string;
  depositUrl?: string;
  adapterType: string;
};
