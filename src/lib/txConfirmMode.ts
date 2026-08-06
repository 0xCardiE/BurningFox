import { effectiveTxConfirmMode, type AppSettings } from './storageState';

/** Whether a dapp provider sign/send should queue the approval sheet. */
export function shouldQueueDappApproval(
  settings: AppSettings,
  opts: { hardware?: boolean; hasLocalKey: boolean },
): boolean {
  if (opts.hardware) return true;
  if (!opts.hasLocalKey) return true;
  return effectiveTxConfirmMode(settings) === 'normal';
}

/** Whether in-wallet sends (inline send, etc.) need an extra confirm step. */
export function shouldConfirmInWalletSend(settings: AppSettings): boolean {
  return effectiveTxConfirmMode(settings) === 'normal';
}
