import { useEffect, useState } from 'react';
import { loadEvmMainnetChains } from '../lib/lifiBootstrap';
import type { ExtendedChain } from '@lifi/types';
import { loadSwapHistory, type SwapHistoryEntry } from '../lib/swapHistory';
import { transactionExplorerUrl } from '../lib/explorerUrls';

function formatSwapHistoryRelTime(at: number): string {
  const d = Date.now() - at;
  if (d < 45_000) return 'Just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPanel() {
  const [swapHistory, setSwapHistory] = useState<SwapHistoryEntry[]>([]);
  const [chainMeta, setChainMeta] = useState<Map<number, ExtendedChain>>(new Map());

  useEffect(() => {
    void loadSwapHistory().then(setSwapHistory);
    void loadEvmMainnetChains().then(chains => {
      setChainMeta(new Map(chains.map(c => [c.id, c])));
    });
  }, []);

  if (swapHistory.length === 0) {
    return (
      <p className="bfox-tools-empty muted">
        No swap history yet. Completed swaps from the Swap tab appear here.
      </p>
    );
  }

  return (
    <ul className="jumpa-history-tab__list jumpa-swap-history__list">
      {swapHistory.map(e => {
        const url = transactionExplorerUrl(e.txChainId, e.txHash, chainMeta.get(e.txChainId));
        const sub =
          (e.crossChain ? 'Bridge' : 'Swap') +
          ' · ' +
          formatSwapHistoryRelTime(e.at) +
          (url ? ' · View tx' : '');
        const inner = (
          <>
            <span className="jumpa-swap-history__pair">
              {e.fromSymbol} → {e.toSymbol}
            </span>
            <span className="jumpa-swap-history__sub muted">{sub}</span>
          </>
        );
        return (
          <li key={e.id}>
            {url ? (
              <a
                className="jumpa-swap-history__row"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <span className="jumpa-swap-history__row jumpa-swap-history__row--dead">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
