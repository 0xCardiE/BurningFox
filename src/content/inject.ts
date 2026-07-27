/**
 * Content script (isolated world) — bridges page provider ↔ extension background.
 */
import {
  PROVIDER_CHANNEL,
  type ProviderRequest,
  type ProviderResponse,
} from '../provider/types';

let cachedReplaceMetaMask = true;

async function loadInjectConfig(): Promise<{ replaceMetaMask: boolean }> {
  try {
    const res = (await chrome.runtime.sendMessage({ type: 'PROVIDER_GET_CONFIG' })) as {
      ok?: boolean;
      replaceMetaMask?: boolean;
    };
    cachedReplaceMetaMask = res?.replaceMetaMask !== false;
  } catch {
    cachedReplaceMetaMask = true;
  }
  return { replaceMetaMask: cachedReplaceMetaMask };
}

void loadInjectConfig();

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.channel !== PROVIDER_CHANNEL) return;

  if (data.target === 'content' && data.type === 'init') {
    void loadInjectConfig().then(config => {
      window.postMessage(
        { channel: PROVIDER_CHANNEL, type: 'init-config', config },
        '*',
      );
    });
    return;
  }

  if (data.target !== 'content' || data.type !== 'request') return;
  const request = data.request as ProviderRequest;
  void chrome.runtime
    .sendMessage({
      type: 'PROVIDER_RPC',
      request,
      origin: window.location.origin,
    })
    .then((response: ProviderResponse) => {
      window.postMessage(
        { channel: PROVIDER_CHANNEL, target: 'inpage', type: 'response', response },
        '*',
      );
    })
    .catch((err: unknown) => {
      const response: ProviderResponse = {
        id: request.id,
        ok: false,
        error: {
          code: 4900,
          message: err instanceof Error ? err.message : String(err),
        },
      };
      window.postMessage(
        { channel: PROVIDER_CHANNEL, target: 'inpage', type: 'response', response },
        '*',
      );
    });
});

chrome.runtime.onMessage.addListener(msg => {
  if (!msg || msg.type !== 'PROVIDER_EMIT') return;
  window.postMessage(
    {
      channel: PROVIDER_CHANNEL,
      target: 'inpage',
      type: 'event',
      event: msg.event,
    },
    '*',
  );
});

/** Keep bridge alive if the service worker slept. */
void chrome.runtime.sendMessage({ type: 'PING' }).catch(() => undefined);