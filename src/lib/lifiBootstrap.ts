import { createConfig } from '@lifi/sdk';
import { getChains } from '@lifi/sdk';
import { ChainType } from '@lifi/types';
import type { ExtendedChain } from '@lifi/types';
import { LIFI_INTEGRATOR_ID } from './constants';
import { mergeLifiChainRpcs } from './chainRpcRegistry';

let started = false;
let evmChains: ExtendedChain[] | null = null;
let pending: Promise<ExtendedChain[]> | null = null;

function loadAndMergeChains(): Promise<ExtendedChain[]> {
  if (evmChains) return Promise.resolve(evmChains);
  if (pending) return pending;
  pending = getChains({ chainTypes: [ChainType.EVM] })
    .then((chains) => {
      mergeLifiChainRpcs(chains);
      evmChains = chains.filter((c) => c.mainnet && c.chainType === ChainType.EVM);
      return evmChains;
    })
    .catch((err) => {
      pending = null;
      throw err;
    });
  return pending;
}

/**
 * Initialise LiFi SDK configuration and prefetch EVM mainnet chains (for RPC URLs + picker).
 */
export function bootstrapLiFi(): void {
  if (started) return;
  started = true;
  createConfig({
    integrator: LIFI_INTEGRATOR_ID,
    preloadChains: false,
    routeOptions: { order: 'CHEAPEST' },
  });
  void loadAndMergeChains();
}

export function loadEvmMainnetChains(): Promise<ExtendedChain[]> {
  bootstrapLiFi();
  return loadAndMergeChains();
}
