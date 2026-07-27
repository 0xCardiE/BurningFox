/** Notify connected dapp tabs that the wallet active chain changed. */
export async function notifyConnectedTabsChainChanged(
  chainId: number,
): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: 'BROADCAST_CHAIN_CHANGED',
      chainId,
    });
  } catch {
    /* background may be unavailable in tests */
  }
}
