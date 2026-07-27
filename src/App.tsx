import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { loadPersisted, type AppSettings } from './lib/storageState';
import { isUnlocked } from './lib/accountSession';
import {
  hydrateAccountFromBackground,
  pingSessionActivity,
  verifyBackgroundSessionStillUnlocked,
} from './lib/sessionBridge';
import { Onboarding } from './ui/Onboarding';
import { Unlock } from './ui/Unlock';
import { SettingsView } from './ui/SettingsView';
import { WalletLayout, type WalletMainTab } from './ui/WalletLayout';
import { WalletHomeView } from './ui/WalletHomeView';
import { SwapView } from './ui/SwapView';
import { ToolsView } from './ui/ToolsView';
import { LoadingScreen } from './ui/LoadingScreen';
import { ScreenFade } from './ui/ScreenFade';

type Screen = 'load' | 'onboard' | 'main';
type MainTab = WalletMainTab;

export function App() {
  const [screen, setScreen] = useState<Screen>('load');
  const [settings, setSettings] = useState<AppSettings>({});
  const [hasVault, setHasVault] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('assets');

  const refresh = useCallback(async () => {
    const s = await loadPersisted();
    setSettings(s.settings);
    setHasVault(!!s.vault);
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await loadPersisted();
      setSettings(s.settings);
      setHasVault(!!s.vault);
      if (!s.vault) {
        setScreen('onboard');
        return;
      }
      await hydrateAccountFromBackground();
      setScreen('main');
    })();
  }, []);

  useEffect(() => {
    if (screen !== 'main') return;
    const bump = () => void pingSessionActivity();
    window.addEventListener('pointerdown', bump, true);
    window.addEventListener('keydown', bump, true);
    void pingSessionActivity();
    const iv = window.setInterval(() => {
      void verifyBackgroundSessionStillUnlocked().then((ok) => {
        if (!ok) window.location.reload();
      });
    }, 45_000);
    return () => {
      window.removeEventListener('pointerdown', bump, true);
      window.removeEventListener('keydown', bump, true);
      window.clearInterval(iv);
    };
  }, [screen]);

  const unlocked = isUnlocked();
  const routeKey =
    screen === 'load'
      ? 'load'
      : !hasVault || screen === 'onboard'
        ? 'onboard'
        : !unlocked
          ? 'unlock'
          : settingsOpen
            ? 'settings'
            : mainTab;

  let shell: ReactNode;
  if (screen === 'load') {
    shell = <LoadingScreen message="Opening Burning Fox…" />;
  } else if (screen === 'onboard' || !hasVault) {
    shell = (
      <Onboarding
        onReady={async () => {
          await refresh();
          setScreen('main');
        }}
      />
    );
  } else if (!unlocked) {
    shell = (
      <Unlock
        onUnlocked={async () => {
          await refresh();
          setScreen('main');
        }}
      />
    );
  } else if (settingsOpen) {
    shell = (
      <SettingsView
        settings={settings}
        onSaved={() => void refresh()}
        onBack={() => setSettingsOpen(false)}
      />
    );
  } else {
    shell = (
      <WalletLayout
        activeTab={mainTab}
        onTabChange={setMainTab}
        onOpenSettings={() => setSettingsOpen(true)}
        settings={settings}
        onSaved={() => void refresh()}
      >
        {mainTab === 'assets' ? (
          <WalletHomeView settings={settings} onSaved={() => void refresh()} />
        ) : null}
        {mainTab === 'swap' ? (
          <SwapView settings={settings} embedded />
        ) : null}
        {mainTab === 'tools' ? <ToolsView settings={settings} /> : null}
      </WalletLayout>
    );
  }

  return <ScreenFade routeKey={routeKey}>{shell}</ScreenFade>;
}
