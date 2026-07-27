import { getAddress } from 'viem';
import {
  allChains,
  chainById,
  getCustomChains,
  isCuratedChain,
  type ChainDefinition,
} from './chainCatalog';
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
  effectiveTxConfirmMode,
  loadPersisted,
  patchSettings,
  type AppSettings,
} from './storageState';
import { connectOrigin, isOriginConnected } from './dappConnections';
import { isSignMethod, queueApprovalRequest } from './pendingApprovals';
import { parseChainIdParam, providerError, toHexChainId } from '../provider/types';
import type { ProviderRequest, ProviderResponse } from '../provider/types';

export async function executeSignRequest(
  pk: `0x${string}`,
  chainId: number,
  method: string,
  params: unknown[],
): Promise<unknown> {
  if (method === 'eth_sendTransaction') {
    const tx = params[0] as Record<string, unknown>;
    if (!tx || typeof tx !== 'object') throw new Error('Invalid transaction');
    return signAndSendTransaction(pk, chainId, tx as never);
  }

  if (method === 'personal_sign' || method === 'eth_sign') {
    const [msgParam, addrParam] = params as [unknown, unknown];
    const addr = addressFromPrivateKey(pk);
    if (typeof addrParam === 'string' && getAddress(addrParam) !== addr) {
      throw new Error('Signer address mismatch');
    }
    return signPersonalMessage(pk, bytesToHexMessage(msgParam as string));
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
    return signEip712(pk, typed);
  }

  throw Object.assign(new Error(`Unsupported method: ${method}`), { code: 4200 });
}

export type ProviderRpcResult = ProviderResponse & {
  /** Set when switch/add chain succeeded so background can emit chainChanged. */
  switchedChainId?: number;
};

export async function handleProviderRpc(
  pk: `0x${string}` | null,
  request: ProviderRequest,
  origin?: string,
  opts?: { tabId?: number; onApprovalQueued?: () => void },
): Promise<ProviderRpcResult> {
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
      if (!chainById(next)) {
        throw Object.assign(
          new Error(`Unrecognized chain ID ${next}. Add the chain first.`),
          { code: 4902 },
        );
      }
      await patchSettings({ activeChainId: next });
      return { id, ok: true, result: null, switchedChainId: next };
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
      if (!isCuratedChain(cid) && !chainById(cid)) {
        const name = (p?.chainName?.trim() || `Chain ${cid}`).slice(0, 64);
        const symbol = (p?.nativeCurrency?.symbol?.trim() || 'ETH').slice(0, 16);
        const decimals =
          typeof p?.nativeCurrency?.decimals === 'number' &&
          Number.isFinite(p.nativeCurrency.decimals)
            ? Math.floor(p.nativeCurrency.decimals)
            : 18;
        const explorers = (p?.blockExplorerUrls ?? [])
          .filter(u => typeof u === 'string' && u.trim())
          .map(u => u.trim());
        const rpcs = (p?.rpcUrls ?? [])
          .filter(u => typeof u === 'string' && u.trim())
          .map(u => u.trim());
        if (rpcs.length === 0) throw new Error('At least one RPC URL is required');
        const def: ChainDefinition = {
          chainId: cid,
          name,
          shortName:
            name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .slice(0, 24) || `chain-${cid}`,
          kind: 'mainnet',
          nativeCurrency: {
            name: p?.nativeCurrency?.name?.trim() || symbol,
            symbol,
            decimals,
          },
          rpcUrls: rpcs,
          blockExplorerUrls: explorers,
        };
        const existing = getCustomChains().filter(c => c.chainId !== cid);
        patch.customChains = [...existing, def];
      }
      await patchSettings(patch);
      return { id, ok: true, result: null, switchedChainId: cid };
    }

    if (isSignMethod(method)) {
      if (effectiveTxConfirmMode(settings) === 'normal') {
        return queueApprovalRequest({
          request,
          origin,
          tabId: opts?.tabId,
          chainId,
          onQueued: opts?.onApprovalQueued,
        });
      }
      const result = await executeSignRequest(pk, chainId, method, params);
      return { id, ok: true, result };
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
  return allChains().map(c => chainMetadataForProvider(c.chainId));
}
