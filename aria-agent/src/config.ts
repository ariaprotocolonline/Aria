import dotenv from 'dotenv';
import path from 'path';
import { createPublicClient, createWalletClient, defineChain, http, type Address } from 'viem';

// Load from monorepo root — same pattern as aria-server. At runtime (compiled),
// __dirname = aria-agent/dist, so ../../ resolves to the ARIA repo root.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
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

// VAULT_ADDRESS: optional single-vault override (used when FACTORY_ADDRESS is absent).
// Placeholder addresses (all-zeros, 0x01 sentinel) are treated as unset.
const rawVault = process.env.VAULT_ADDRESS ?? '';
const PLACEHOLDER_VAULTS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
]);
export const VAULT_ADDRESS: Address | null =
  /^0x[0-9a-fA-F]{40}$/.test(rawVault) && !PLACEHOLDER_VAULTS.has(rawVault.toLowerCase())
    ? (rawVault as Address)
    : null;

// FACTORY_ADDRESS: preferred — agent discovers all user vaults from the factory.
const rawFactory = process.env.FACTORY_ADDRESS ?? '';
export const FACTORY_ADDRESS: Address | null =
  /^0x[0-9a-fA-F]{40}$/.test(rawFactory) && rawFactory !== '0x0000000000000000000000000000000000000000'
    ? (rawFactory as Address)
    : null;

if (!FACTORY_ADDRESS && !VAULT_ADDRESS) {
  console.warn('[Config] No FACTORY_ADDRESS or valid VAULT_ADDRESS — agent will scan pools but skip vault cycles until contracts are deployed');
}

// DeepSeek is the AI provider. ANTHROPIC_API_KEY kept for legacy imports only.
export const DEEPSEEK_API_KEY  = requireEnv('DEEPSEEK_API_KEY');
export const DEEPSEEK_MODEL    = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

const rawInterval = parseInt(process.env.CYCLE_INTERVAL_MS ?? '60000', 10);
if (isNaN(rawInterval) || rawInterval < 10_000) {
  throw new Error('CYCLE_INTERVAL_MS must be a number ≥ 10000 (10 seconds minimum)');
}
export const CYCLE_INTERVAL_MS = rawInterval;

const validProfiles = ['Conservative', 'Balanced', 'Aggressive'] as const;
type RiskProfile = typeof validProfiles[number];
const rawProfile = process.env.RISK_PROFILE ?? 'Balanced';
if (!validProfiles.includes(rawProfile as RiskProfile)) {
  throw new Error(`RISK_PROFILE must be one of: ${validProfiles.join(', ')}. Got: "${rawProfile}"`);
}
export const RISK_PROFILE = rawProfile as RiskProfile;

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

console.log(`[Config] Agent wallet:   ${agentAccount.address}`);
console.log(`[Config] Factory:        ${FACTORY_ADDRESS ?? '(not set)'}`);
console.log(`[Config] Vault override: ${VAULT_ADDRESS ?? '(none — using factory)'}`);
console.log(`[Config] Network:        ${isTestnet ? 'Mantle Sepolia (testnet)' : 'Mantle Mainnet'}`);

// Optional intelligence integrations — warn on startup if keys are missing,
// but do NOT crash. The agent runs fine without them; they are additive only.
if (!process.env.ELFA_API_KEY) {
  console.warn('[Config] ELFA_API_KEY not set — Elfa social signals disabled');
}
if (!process.env.NANSEN_API_KEY) {
  console.warn('[Config] NANSEN_API_KEY not set — Nansen pool intelligence disabled');
}
