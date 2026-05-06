import 'dotenv/config';
import { createPublicClient, createWalletClient, defineChain, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const mantleMainnet = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: { decimals: 18, name: 'MNT', symbol: 'MNT' },
  rpcUrls: {
    default: { http: [process.env.MANTLE_MAINNET_RPC ?? 'https://rpc.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: 'https://explorer.mantle.xyz' },
  },
});

export const mantleTestnet = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { decimals: 18, name: 'MNT', symbol: 'MNT' },
  rpcUrls: {
    default: { http: [process.env.MANTLE_TESTNET_RPC ?? 'https://rpc.sepolia.mantle.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Mantle Sepolia Explorer', url: 'https://explorer.sepolia.mantle.xyz' },
  },
  testnet: true,
});

const isTestnet = process.env.MANTLE_NETWORK === 'testnet';
const activeChain = isTestnet ? mantleTestnet : mantleMainnet;
const activeRpc = isTestnet
  ? (process.env.MANTLE_TESTNET_RPC ?? 'https://rpc.sepolia.mantle.xyz')
  : (process.env.MANTLE_MAINNET_RPC ?? 'https://rpc.mantle.xyz');

const rawKey = requireEnv('AGENT_PRIVATE_KEY');
const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;

export const agentAccount = privateKeyToAccount(privateKey);

export const VAULT_ADDRESS = requireEnv('VAULT_ADDRESS') as Address;
export const ANTHROPIC_API_KEY = requireEnv('ANTHROPIC_API_KEY');
export const CYCLE_INTERVAL_MS = parseInt(process.env.CYCLE_INTERVAL_MS ?? '60000', 10);
export const RISK_PROFILE = (process.env.RISK_PROFILE ?? 'Balanced') as 'Conservative' | 'Balanced' | 'Aggressive';

const transport = http(activeRpc);

export const publicClient = createPublicClient({
  chain: activeChain,
  transport,
});

export const walletClient = createWalletClient({
  account: agentAccount,
  chain: activeChain,
  transport,
});
