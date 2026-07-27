import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  padHex,
  type Hex,
} from 'viem';
import { ERC20_ABI } from './abis';
import { chainJsonRpcCall } from './ethereum';

/** keccak256("Approval(address,address,uint256)") */
export const APPROVAL_EVENT_TOPIC =
  '0x8c5be1e5ebec7d7bd7747e08f48e0be663667bf5a8d07aa3ad0401123169c3' as const;

/** Block to start scanning — balances RPC limits vs completeness. */
const SCAN_FROM_BLOCK: Record<number, number> = {
  1: 17_000_000,
  56: 25_000_000,
  137: 40_000_000,
  42161: 50_000_000,
  8453: 1,
  10: 80_000_000,
  43114: 25_000_000,
  324: 1,
  59144: 1,
  534352: 1,
  250: 50_000_000,
  100: 25_000_000,
  5000: 1,
  81457: 1,
  42220: 15_000_000,
  1284: 1,
  25: 10_000_000,
  1101: 1,
  34443: 1,
  1313161554: 1,
};

const DEFAULT_SCAN_FROM = 1;
const LOG_CHUNK_SIZE = 2_000;

/** Well-known spenders — extend as needed. */
const SPENDER_LABELS: Record<string, string> = {
  '0x1231deb6f5749ef6ce6943a275a1d3e7516d0f8b': 'LI.FI Diamond',
  '0xdef1abe32c034e558cfd916101754055eb1e69ba': '0x Exchange Proxy',
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3 Router',
  '0x3fc91a3afd70395cd496c647d0a4624bb7771703': 'Uniswap Universal Router',
  '0x1111111254eeb25477b68fb85ed929f73bbf96072': '1inch v5',
  '0x111111125421ca6dc452d289314280a0f8842a65': '1inch v6',
};

export type TokenApprovalRow = {
  token: `0x${string}`;
  tokenSymbol: string;
  tokenName: string;
  tokenDecimals: number;
  spender: `0x${string}`;
  spenderLabel: string | null;
  allowance: bigint;
};

export type ApprovalScanProgress = {
  phase: 'logs' | 'allowances';
  fromBlock: number;
  toBlock: number;
  latestBlock: number;
};

type RpcLog = {
  address: string;
  topics: Hex[];
  data: Hex;
};

function ownerTopic(owner: string): Hex {
  return padHex(getAddress(owner), { size: 32 });
}

function spenderFromTopic(topic: Hex | undefined): `0x${string}` | null {
  if (!topic || topic.length < 66) return null;
  try {
    return getAddress(`0x${topic.slice(-40)}`);
  } catch {
    return null;
  }
}

function pairKey(token: string, spender: string): string {
  return `${token.toLowerCase()}:${spender.toLowerCase()}`;
}

function spenderLabel(addr: string): string | null {
  return SPENDER_LABELS[addr.toLowerCase()] ?? null;
}

async function latestBlockNumber(chainId: number): Promise<number> {
  const hex = await chainJsonRpcCall<string>(chainId, 'eth_blockNumber', []);
  return Number.parseInt(hex, 16);
}

async function fetchLogsRange(
  chainId: number,
  owner: string,
  fromBlock: number,
  toBlock: number,
): Promise<RpcLog[]> {
  return chainJsonRpcCall<RpcLog[]>(chainId, 'eth_getLogs', [
    {
      fromBlock: `0x${fromBlock.toString(16)}`,
      toBlock: `0x${toBlock.toString(16)}`,
      topics: [APPROVAL_EVENT_TOPIC, ownerTopic(owner)],
    },
  ]);
}

async function readErc20Meta(
  chainId: number,
  token: `0x${string}`,
): Promise<{ symbol: string; name: string; decimals: number }> {
  const symData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'symbol', args: [] });
  const decData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'decimals', args: [] });
  const nameData = encodeFunctionData({ abi: ERC20_ABI, functionName: 'name', args: [] });

  let symbol = token.slice(0, 8);
  let name = symbol;
  let decimals = 18;

  for (const [data, fn] of [
    [symData, 'symbol'],
    [decData, 'decimals'],
    [nameData, 'name'],
  ] as const) {
    try {
      const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
        { to: token, data },
        'latest',
      ]);
      const val = decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: fn,
        data: raw as Hex,
      });
      if (fn === 'symbol') symbol = String(val);
      else if (fn === 'name') name = String(val);
      else decimals = Number(val);
    } catch {
      /* keep fallback */
    }
  }
  return { symbol, name, decimals };
}

async function readAllowance(
  chainId: number,
  token: `0x${string}`,
  owner: string,
  spender: `0x${string}`,
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [getAddress(owner), spender],
  });
  const raw = await chainJsonRpcCall<string>(chainId, 'eth_call', [
    { to: token, data },
    'latest',
  ]);
  return decodeFunctionResult({
    abi: ERC20_ABI,
    functionName: 'allowance',
    data: raw as Hex,
  }) as bigint;
}

/**
 * Scan ERC-20 Approval logs via public JSON-RPC, then verify current allowance on-chain.
 * No third-party indexer — works on any chain with eth_getLogs (chunked for RPC limits).
 */
export async function scanTokenApprovals(params: {
  chainId: number;
  owner: string;
  onProgress?: (p: ApprovalScanProgress) => void;
}): Promise<TokenApprovalRow[]> {
  const owner = getAddress(params.owner);
  const chainId = params.chainId;
  const latest = await latestBlockNumber(chainId);
  const scanFrom = SCAN_FROM_BLOCK[chainId] ?? DEFAULT_SCAN_FROM;

  const pairs = new Set<string>();
  const pairList: Array<{ token: `0x${string}`; spender: `0x${string}` }> = [];

  for (let from = scanFrom; from <= latest; from += LOG_CHUNK_SIZE + 1) {
    const to = Math.min(from + LOG_CHUNK_SIZE, latest);
    params.onProgress?.({
      phase: 'logs',
      fromBlock: from,
      toBlock: to,
      latestBlock: latest,
    });

    let logs: RpcLog[] = [];
    try {
      logs = await fetchLogsRange(chainId, owner, from, to);
    } catch {
      /* skip failed chunk — common on strict RPC block limits */
      continue;
    }

    for (const log of logs) {
      let token: `0x${string}`;
      try {
        token = getAddress(log.address);
      } catch {
        continue;
      }
      const spender = spenderFromTopic(log.topics[2]);
      if (!spender) continue;
      const key = pairKey(token, spender);
      if (pairs.has(key)) continue;
      pairs.add(key);
      pairList.push({ token, spender });
    }
  }

  const rows: TokenApprovalRow[] = [];
  let i = 0;
  for (const { token, spender } of pairList) {
    i += 1;
    params.onProgress?.({
      phase: 'allowances',
      fromBlock: i,
      toBlock: pairList.length,
      latestBlock: latest,
    });

    let allowance: bigint;
    try {
      allowance = await readAllowance(chainId, token, owner, spender);
    } catch {
      continue;
    }
    if (allowance <= 0n) continue;

    const meta = await readErc20Meta(chainId, token);
    rows.push({
      token,
      tokenSymbol: meta.symbol,
      tokenName: meta.name,
      tokenDecimals: meta.decimals,
      spender,
      spenderLabel: spenderLabel(spender),
      allowance,
    });
  }

  rows.sort((a, b) => {
    if (a.allowance !== b.allowance) return a.allowance > b.allowance ? -1 : 1;
    return a.tokenSymbol.localeCompare(b.tokenSymbol);
  });

  return rows;
}

export function isUnlimitedAllowance(allowance: bigint): boolean {
  return allowance > 2n ** 200n;
}
