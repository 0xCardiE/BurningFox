import { useMemo, useState } from 'react';
import {
  effectiveActiveChainId,
  patchSettings,
  type AppSettings,
} from '../lib/storageState';
import {
  allChains,
  chainById,
  chainsByKind,
  type ChainDefinition,
  type ChainKind,
} from '../lib/chainCatalog';
import { chainLogoUri } from '../lib/chainLogo';
import { notifyConnectedTabsChainChanged } from '../lib/chainSyncBridge';
import { allRpcOptionsFor } from '../lib/chainRpcRegistry';
import { describeError } from '../lib/utils';
import { BfoxSelect, BfoxSegmented, type BfoxSelectGroup } from './BfoxSelect';

type NetFilter = ChainKind;

function chainGroups(kind: NetFilter): BfoxSelectGroup[] {
  const label = kind === 'mainnet' ? 'Mainnets' : 'Testnets';
  return [{ label, options: chainsByKind(kind).map(chainToOption) }];
}

function defaultChainForKind(kind: NetFilter): number {
  return chainsByKind(kind)[0]?.chainId ?? 1;
}

function shortRpcLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url;
  }
}

function rpcProviderHint(url: string): string {
  const host = shortRpcLabel(url).toLowerCase();
  if (host.includes('publicnode')) return 'PublicNode';
  if (host.includes('drpc')) return 'dRPC';
  if (host.includes('ankr')) return 'Ankr';
  if (host.includes('llamarpc')) return 'LlamaRPC';
  if (host.includes('blastapi')) return 'Blast';
  if (host.includes('1rpc')) return '1RPC';
  if (host.includes('meowrpc')) return 'MeowRPC';
  if (host.includes('tenderly')) return 'Tenderly';
  if (host.includes('binance')) return 'Binance';
  if (host.includes('alchemy')) return 'Alchemy';
  return 'Public';
}

function chainToOption(c: ChainDefinition) {
  return {
    value: String(c.chainId),
    label: c.name,
    sublabel: c.kind === 'testnet' ? `Testnet · ${c.chainId}` : String(c.chainId),
    logoURI: chainLogoUri(c),
  };
}

type Props = {
  settings: AppSettings;
  onSaved: () => void;
  compact?: boolean;
};

export function NetworkSelector({ settings, onSaved }: Props) {
  const activeChainId = effectiveActiveChainId(settings);
  const activeChain = chainById(activeChainId);
  const netFilter: NetFilter = activeChain?.kind ?? 'mainnet';
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rpcOptions = useMemo(
    () => allRpcOptionsFor(activeChainId),
    [activeChainId, settings.preferredRpcByChain, settings.customRpcByChain],
  );

  const rpcUrl = useMemo(() => {
    const preferred = settings.preferredRpcByChain?.[String(activeChainId)];
    if (preferred && rpcOptions.includes(preferred)) return preferred;
    return rpcOptions[0] ?? '';
  }, [activeChainId, settings.preferredRpcByChain, rpcOptions]);

  const chainGroupsMemo = useMemo(
    () => chainGroups(netFilter),
    [netFilter, settings.customChains],
  );

  const rpcGroups = useMemo<BfoxSelectGroup[]>(
    () => [
      {
        label: 'RPC endpoints',
        options: rpcOptions.map(u => ({
          value: u,
          label: shortRpcLabel(u),
          sublabel: rpcProviderHint(u),
        })),
      },
    ],
    [rpcOptions],
  );

  async function onChainChange(nextId: number) {
    if (nextId === activeChainId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchSettings({ activeChainId: nextId });
      await notifyConnectedTabsChainChanged(nextId);
      onSaved();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRpcChange(nextUrl: string) {
    if (!nextUrl.trim() || nextUrl === rpcUrl || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await patchSettings({
        preferredRpcByChain: {
          ...(settings.preferredRpcByChain ?? {}),
          [String(activeChainId)]: nextUrl.trim(),
        },
      });
      onSaved();
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onFilterChange(next: NetFilter) {
    if (next === netFilter || busy) return;
    setOpenMenu(null);
    await onChainChange(defaultChainForKind(next));
  }

  const activeInCatalog = allChains().some(c => c.chainId === activeChainId);

  return (
    <div className="bfox-net-select">
      <BfoxSegmented
        value={netFilter}
        onChange={v => void onFilterChange(v as NetFilter)}
        options={[
          { value: 'mainnet', label: 'Mainnets' },
          { value: 'testnet', label: 'Testnets' },
        ]}
      />

      <div className="bfox-net-select__row">
        <BfoxSelect
          id="bfox-chain"
          label="Chain"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          value={String(activeChainId)}
          triggerLabel={activeChain?.name ?? `Chain ${activeChainId}`}
          triggerSublabel={
            activeChain
              ? activeChain.kind === 'testnet'
                ? 'Testnet'
                : 'Mainnet'
              : activeInCatalog
                ? undefined
                : 'Custom'
          }
          triggerLogoURI={activeChain ? chainLogoUri(activeChain) : undefined}
          groups={chainGroupsMemo}
          disabled={busy}
          panelMaxHeight={320}
          onPick={v => void onChainChange(Number(v))}
        />

        <BfoxSelect
          id="bfox-rpc"
          label="RPC"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          value={rpcUrl}
          triggerLabel={rpcUrl ? shortRpcLabel(rpcUrl) : 'No RPC'}
          triggerSublabel={rpcUrl ? rpcProviderHint(rpcUrl) : undefined}
          groups={rpcGroups}
          disabled={busy || rpcOptions.length === 0}
          panelMaxHeight={300}
          onPick={v => void onRpcChange(v)}
        />
      </div>

      {err ? <p className="error bfox-net-select__err">{err}</p> : null}
    </div>
  );
}
