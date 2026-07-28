import { getQuote, getTokens } from '@lifi/sdk';
import { ChainType } from '@lifi/types';
import type { ExtendedChain, LiFiStep, Token } from '@lifi/types';
import { getAddress, parseUnits } from 'viem';
import { isNativeToken, tokenKeyForQuote } from './lifiHelpers';

export type GasTopUpQuoteParams = {
  wallet: string;
  fromChainId: number;
  toChainId: number;
  fromToken: Token;
  toNativeToken: Token;
  /** Desired native amount on the destination chain (human units). */
  gasAmountHuman: string;
  slippage: number;
};

export async function resolveNativeToken(chainId: number): Promise<Token | null> {
  const res = await getTokens({
    chains: [chainId],
    chainTypes: [ChainType.EVM],
  });
  const list = res.tokens[chainId] ?? [];
  return list.find(t => isNativeToken(t.address)) ?? null;
}

export async function fetchGasTopUpQuote(params: GasTopUpQuoteParams): Promise<LiFiStep> {
  const parsed = params.gasAmountHuman.trim();
  if (!parsed) throw new Error('Enter how much gas you need.');
  let wei: bigint;
  try {
    wei = parseUnits(parsed, params.toNativeToken.decimals);
  } catch {
    throw new Error('Gas amount decimals out of range.');
  }
  if (wei <= 0n) throw new Error('Gas amount must be greater than zero.');

  const fromAddr = getAddress(params.wallet);
  const q = await getQuote({
    fromChain: params.fromChainId,
    toChain: params.toChainId,
    fromToken: tokenKeyForQuote(params.fromToken.address),
    toToken: tokenKeyForQuote(params.toNativeToken.address),
    toAmount: wei.toString(),
    fromAddress: fromAddr,
    toAddress: fromAddr,
    slippage: params.slippage,
  });

  if (!q.transactionRequest) {
    throw new Error(
      'No route found for this gas top-up. Try another token, chain, or amount.',
    );
  }
  return q;
}

export function chainLabel(chain: ExtendedChain | undefined, chainId: number): string {
  return chain?.name ?? `Chain ${chainId}`;
}

export function formatToolRoute(step: LiFiStep): string {
  const name = step.toolDetails?.name ?? step.tool;
  if (/relay/i.test(name) || step.tool.toLowerCase() === 'relay') {
    return 'Relay (via LiFi)';
  }
  if (name) return `${name} (via LiFi)`;
  return 'LiFi';
}
