import { L33tSegmented } from './L33tSelect';
import {
  effectiveTxConfirmMode,
  patchSettings,
  type AppSettings,
  type TxConfirmMode,
} from '../lib/storageState';

const MODE_HINTS: Record<TxConfirmMode, string> = {
  speed: 'Transactions confirm automatically when unlocked.',
  normal: 'Review and confirm each dapp request.',
};

export function TxConfirmModeToggle({
  settings,
  onSaved,
}: {
  settings: AppSettings;
  onSaved: () => void;
}) {
  const mode = effectiveTxConfirmMode(settings);

  async function onChange(next: string) {
    await patchSettings({ txConfirmMode: next as TxConfirmMode });
    onSaved();
  }

  return (
    <L33tSegmented
      className="l33t-seg--compact"
      value={mode}
      onChange={onChange}
      ariaLabel="Transaction confirmation mode"
      title={MODE_HINTS[mode]}
      options={[
        { value: 'speed', label: 'Turbo' },
        { value: 'normal', label: 'Normal' },
      ]}
    />
  );
}
