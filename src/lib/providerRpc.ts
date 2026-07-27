import { getAddress } from 'viem';
import { chainById, CHAIN_CATALOG } from './chainCatalog';
import {
  addressFromPrivateKey,
  bytesToHexMessage,
  parseTypedDataParam,
  signAndSendTransaction,
  signEip712,
  signPersonalMessage,
} from './backgroundSign';
import {
  effectiveActiveChainId,
  loadPersisted,
  patchSettings,
  type AppSettings,
} from './storageState';
import { connectOrigin, isOriginConnected } from './dappConnections';
import { parseChainIdParam, providerError, toHexChainId } from '../provider/types';
import type { ProviderRequest, ProviderResponse } from '../provider/types';

export async function handleProviderRpc(
  pk: `0x${string}` | null,
  request: ProviderRequest,
  origin?: string,
): Promise<ProviderResponse> {
  const { id, method, params = [] } = request;
  try {
    const { settings } = await loadPersisted();
    const chainId = effectiveActiveChainId(settings);

    if (method === 'eth_chainId') {
      return { id, ok: true, result: toHexChainId(chainId) };
    }

    if (method === 'net_version') {
      return { id, ok: true, result: String(chainId) };
    }

    if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
      if (!pk) {
        if (method === 'eth_requestAccounts') {
          throw Object.assign(new Error('Burning Fox is locked. Unlock the extension first.'), {
            code: 4100,
          });
        }
        return { id, ok: true, result: [] };
      }
      const addr = getAddress(addressFromPrivateKey(pk));
      if (method === 'eth_requestAccounts') {
        if (origin) await connectOrigin(origin);
        return { id, ok: true, result: [addr] };
      }
      if (origin && !(await isOriginConnected(origin))) {
        return { id, ok: true, result: [] };
      }
      return { id, ok: true, result: [addr] };
    }

    if (!pk) {
      throw Object.assign(new Error('Burning Fox is locked. Unlock the extension first.'), {
        code: 4100,
      });
    }

    if (method === 'wallet_switchEthereumChain') {
      const p = params[0] as { chainId?: string } | undefined;
      const next = parseChainIdParam(p?.chainId);
      if (next == null) throw new Error('Invalid chainId');
      await patchSettings({ activeChainId: next });
      return { id, ok: true, result: null };
    }

    if (method === 'wallet_addEthereumChain') {
      const p = params[0] as {
        chainId?: string;
        chainName?: string;
        rpcUrls?: string[];
        nativeCurrency?: { name: string; symbol: string; decimals: number };
        blockExplorerUrls?: string[];
      };
      const cid = parseChainIdParam(p?.chainId);
      if (cid == null) throw new Error('Invalid chainId');
      const rpc = p?.rpcUrls?.[0]?.trim();
      const patch: AppSettings = { activeChainId: cid };
      if (rpc) {
        patch.preferredRpcByChain = {
          ...(settings.preferredRpcByChain ?? {}),
          [String(cid)]: rpc,
        };
      }
      if (p?.rpcUrls?.length) {
        const custom = [...(settings.customRpcByChain?.[String(cid)] ?? [])];
        for (const u of p.rpcUrls) {
          if (u?.trim() && !custom.includes(u.trim())) custom.push(u.trim());
        }
        patch.customRpcByChain = {
          ...(settings.customRpcByChain ?? {}),
          [String(cid)]: custom,
        };
      }
      await patchSettings(patch);
      return { id, ok: true, result: null };
    }

    if (method === 'eth_sendTransaction') {
      const tx = params[0] as Record<string, unknown>;
      if (!tx || typeof tx !== 'object') throw new Error('Invalid transaction');
      const hash = await signAndSendTransaction(pk, chainId, tx as never);
      return { id, ok: true, result: hash };
    }

    if (method === 'personal_sign' || method === 'eth_sign') {
      const [msgParam, addrParam] = params as [unknown, unknown];
      const addr = addressFromPrivateKey(pk);
      if (typeof addrParam === 'string' && getAddress(addrParam) !== addr) {
        throw new Error('Signer address mismatch');
      }
      const sig = await signPersonalMessage(pk, bytesToHexMessage(msgParam as string));
      return { id, ok: true, result: sig };
    }

    if (
      method === 'eth_signTypedData' ||
      method === 'eth_signTypedData_v3' ||
      method === 'eth_signTypedData_v4'
    ) {
      let typedRaw = params[1] ?? params[0];
      if (method === 'eth_signTypedData_v3' || method === 'eth_signTypedData_v4') {
        typedRaw = params[1];
      }
      const typed = parseTypedDataParam(typedRaw);
      const sig = await signEip712(pk, typed);
      return { id, ok: true, result: sig };
    }

    throw Object.assign(new Error(`Unsupported method: ${method}`), { code: 4200 });
  } catch (err) {
    const e = err as Error & { code?: number };
    return {
      id,
      ok: false,
      error: providerError(e.code ?? 4001, e.message ?? String(err)),
    };
  }
}

export function chainMetadataForProvider(chainId: number): unknown {
  const c = chainById(chainId);
  if (!c) return null;
  return {
    chainId: toHexChainId(c.chainId),
    chainName: c.name,
    rpcUrls: c.rpcUrls,
    nativeCurrency: c.nativeCurrency,
    blockExplorerUrls: c.blockExplorerUrls,
  };
}

export function allProviderChains(): unknown[] {
  return CHAIN_CATALOG.map(c => chainMetadataForProvider(c.chainId));
}
