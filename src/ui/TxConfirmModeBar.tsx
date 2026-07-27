import { BfoxSegmented } from './BfoxSelect';
import {
  effectiveTxConfirmMode,
  patchSettings,
  type AppSettings,
  type TxConfirmMode,
} from '../lib/storageState';

export function TxConfirmModeBar({
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
    <div className="bfox-tx-mode" aria-label="Transaction confirmation mode">
      <BfoxSegmented
        value={mode}
        onChange={onChange}
        ariaLabel="Transaction confirmation mode"
        options={[
          { value: 'speed', label: 'Speed up' },
          { value: 'normal', label: 'Normal' },
        ]}
      />
      <p className="bfox-tx-mode__hint">
        {mode === 'speed'
          ? 'Transactions confirm automatically when unlocked.'
          : 'Review and confirm each dapp request.'}
      </p>
    </div>
  );
}
