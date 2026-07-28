import type { PendingApproval } from './pendingApprovals';
import type { GasOverrideInput } from './gasOverrides';

function sendMessage<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response: T) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      resolve(response);
    });
  });
}

export async function fetchPendingApprovals(): Promise<PendingApproval[]> {
  try {
    const res = (await sendMessage<{ ok: boolean; pending?: PendingApproval[] }>({
      type: 'GET_PENDING_APPROVALS',
    })) as { ok: boolean; pending?: PendingApproval[] };
    return res?.ok && Array.isArray(res.pending) ? res.pending : [];
  } catch {
    return [];
  }
}

export async function resolvePendingApproval(
  id: string,
  approved: boolean,
  gasOverrides?: GasOverrideInput,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = (await sendMessage<{ ok: boolean; error?: string }>({
      type: 'RESOLVE_PENDING_APPROVAL',
      id,
      approved,
      gasOverrides,
    })) as { ok: boolean; error?: string };
    return res ?? { ok: false, error: 'No response' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
