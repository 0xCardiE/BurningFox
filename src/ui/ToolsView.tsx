import { useState } from 'react';
import type { AppSettings } from '../lib/storageState';
import { MultiSendView } from './MultiSendView';
import { HistoryPanel } from './HistoryPanel';
import { ApprovalsPanel } from './ApprovalsPanel';

export type ToolsSubTab = 'multisend' | 'history' | 'approvals';

const TOOL_TABS: { id: ToolsSubTab; label: string }[] = [
  { id: 'multisend', label: 'Multisend' },
  { id: 'history', label: 'History' },
  { id: 'approvals', label: 'Approvals' },
];

export function ToolsView({ settings }: { settings: AppSettings }) {
  const [tab, setTab] = useState<ToolsSubTab>('multisend');

  return (
    <div className="bfox-tools">
      <nav className="bfox-tools-tabs" aria-label="Tools">
        {TOOL_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`bfox-tools-tabs__btn${tab === t.id ? ' bfox-tools-tabs__btn--on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="bfox-tools-panel">
        {tab === 'multisend' ? <MultiSendView settings={settings} /> : null}
        {tab === 'history' ? <HistoryPanel /> : null}
        {tab === 'approvals' ? <ApprovalsPanel settings={settings} /> : null}
      </div>
    </div>
  );
}
