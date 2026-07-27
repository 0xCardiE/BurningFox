import type { ReactNode } from 'react';
import type { AppSettings } from '../lib/storageState';
import { ScreenHeader } from './ScreenHeader';
import { NetworkSelector } from './NetworkSelector';
import { DappConnectionBar } from './DappConnectionBar';
import { TxApprovalSheet } from './TxApprovalSheet';

export type WalletMainTab = 'assets' | 'swap' | 'tools';

const TAB_LABELS: Record<WalletMainTab, string> = {
  assets: 'Assets',
  swap: 'Swap',
  tools: 'Tools',
};

export function WalletLayout({
  activeTab,
  onTabChange,
  onOpenSettings,
  settings,
  onSaved,
  children,
}: {
  activeTab: WalletMainTab;
  onTabChange: (tab: WalletMainTab) => void;
  onOpenSettings: () => void;
  settings: AppSettings;
  onSaved: () => void;
  children: ReactNode;
}) {
  const settingsBtn = (
    <button
      type="button"
      className="bfox-icon-head"
      onClick={onOpenSettings}
      aria-label="Settings"
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  );

  return (
    <div className="wallet-shell bfox bfox--main">
      <ScreenHeader title="Burning Fox" trailing={settingsBtn} />

      <nav className="bfox-mm-tabs" aria-label="Wallet sections">
        {(Object.keys(TAB_LABELS) as WalletMainTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            className={`bfox-mm-tabs__btn${activeTab === tab ? ' bfox-mm-tabs__btn--on' : ''}`}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => onTabChange(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <div className="bfox-layout-network">
        <NetworkSelector settings={settings} onSaved={onSaved} compact />
      </div>

      <div className="screen-body bfox-body bfox-body--main">{children}</div>

      <DappConnectionBar settings={settings} onSaved={onSaved} />
      <TxApprovalSheet />
    </div>
  );
}