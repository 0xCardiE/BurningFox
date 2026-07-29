import { useState } from 'react';
import type { AppSettings } from '../lib/storageState';
import { MultiSendView } from './MultiSendView';
import { ApprovalsPanel } from './ApprovalsPanel';
import { GasStationView } from './GasStationView';
import { SwapView } from './SwapView';

export type ToolsSubTab = 'multisend' | 'gas' | 'approvals' | 'swap';

const TOOL_TABS: { id: ToolsSubTab; label: string }[] = [
  { id: 'multisend', label: 'Multisend' },
  { id: 'gas', label: 'Gas' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'swap', label: 'Swap' },
];

export function ToolsView({ settings }: { settings: AppSettings }) {
  const [tab, setTab] = useState<ToolsSubTab>('multisend');

  return (
    <div className="l33t-tools">
      <nav className="l33t-tools-tabs" aria-label="Tools">
        {TOOL_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`l33t-tools-tabs__btn${tab === t.id ? ' l33t-tools-tabs__btn--on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="l33t-tools-panel">
        {tab === 'multisend' ? <MultiSendView settings={settings} /> : null}
        {tab === 'gas' ? <GasStationView settings={settings} /> : null}
        {tab === 'approvals' ? <ApprovalsPanel settings={settings} /> : null}
        {tab === 'swap' ? <SwapView settings={settings} embedded /> : null}
      </div>
    </div>
  );
}
