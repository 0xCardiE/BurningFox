import TrezorConnect from '@trezor/connect-webextension';

const TREZOR_CONNECT_SRC = 'https://connect.trezor.io/9/';

let initPromise: Promise<void> | undefined;

export function initTrezorConnect(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await TrezorConnect.init({
          lazyLoad: true,
          manifest: {
            email: 'burnbox@proton.me',
            appName: 'BurnBox',
            appUrl: 'https://github.com/0xCardiE/BurningFox',
          },
          connectSrc: TREZOR_CONNECT_SRC,
          _extendWebextensionLifetime: true,
        });
      } catch (err) {
        initPromise = undefined;
        throw err;
      }
    })();
  }
  return initPromise;
}

export function isTrezorMessage(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const type = (message as { type?: string }).type;
  return (
    type === 'TREZOR_INIT' ||
    type === 'TREZOR_ETHEREUM_GET_ADDRESS' ||
    type === 'TREZOR_ETHEREUM_SIGN_TRANSACTION'
  );
}

export async function handleTrezorMessage(message: {
  type: string;
  path?: string;
  transaction?: Record<string, unknown>;
}): Promise<{ success: boolean; payload?: unknown; error?: string }> {
  try {
    await initTrezorConnect();
    if (message.type === 'TREZOR_INIT') {
      return { success: true, payload: { ok: true } };
    }
    if (message.type === 'TREZOR_ETHEREUM_GET_ADDRESS') {
      const path = message.path?.trim();
      if (!path) return { success: false, error: 'Missing derivation path.' };
      const result = await TrezorConnect.ethereumGetAddress({
        path,
        showOnTrezor: true,
      });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor get address failed.',
          payload: result.payload,
        };
      }
      return { success: true, payload: result.payload };
    }
    if (message.type === 'TREZOR_ETHEREUM_SIGN_TRANSACTION') {
      const path = message.path?.trim();
      const transaction = message.transaction;
      if (!path || !transaction) {
        return { success: false, error: 'Missing path or transaction.' };
      }
      const result = await TrezorConnect.ethereumSignTransaction({
        path,
        transaction: transaction as never,
      });
      if (!result.success) {
        return {
          success: false,
          error: result.payload?.error || 'Trezor sign failed.',
          payload: result.payload,
        };
      }
      return { success: true, payload: result.payload };
    }
    return { success: false, error: 'Unknown Trezor message.' };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
