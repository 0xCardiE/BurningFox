import type { Hex, TransactionSerializable } from 'viem';
import { DEFAULT_ETH_DERIVATION_PATH, type WalletAccount } from './accounts';
import { chainJsonRpcCall } from './ethereum';
import { signTxWithLedger } from './ledger';
import { signTxWithTrezor } from './trezor';

export async function signAndSendWithHardware(params: {
  account: WalletAccount;
  chainId: number;
  tx: TransactionSerializable & { to: Hex };
}): Promise<Hex> {
  if (params.account.kind !== 'ledger' && params.account.kind !== 'trezor') {
    throw new Error('Not a hardware account.');
  }
  const path = params.account.derivationPath || DEFAULT_ETH_DERIVATION_PATH;
  const tx = { ...params.tx, chainId: params.chainId };

  const signed =
    params.account.kind === 'ledger'
      ? await signTxWithLedger({ derivationPath: path, tx })
      : await signTxWithTrezor({
          derivationPath: path,
          tx: tx as TransactionSerializable & { to: Hex; chainId: number },
        });

  return chainJsonRpcCall<Hex>(params.chainId, 'eth_sendRawTransaction', [signed]);
}
