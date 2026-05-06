import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain, http, fallback } from 'viem';
import { env } from './config/env';

export const mantleMainnet = defineChain({
  id: 5000,
  name: 'Mantle',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: [env.MANTLE_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Mantle Explorer', url: env.MANTLE_EXPLORER_URL },
  },
});

export const mantleTestnet = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
  rpcUrls: {
    default: { http: [env.MANTLE_TESTNET_RPC_URL] },
  },
  blockExplorers: {
    default: { name: 'Mantle Sepolia Explorer', url: env.MANTLE_TESTNET_EXPLORER_URL },
  },
  testnet: true,
});

export const wagmiConfig = getDefaultConfig({
  appName: env.APP_NAME,
  projectId: env.WALLETCONNECT_PROJECT_ID,
  chains: [mantleMainnet, mantleTestnet],
  transports: {
    [mantleMainnet.id]: http('https://rpc.mantle.xyz'),
    [mantleTestnet.id]: fallback([
      http('https://rpc.sepolia.mantle.xyz'),
      http('https://mantle-sepolia.drpc.org'),
      http('https://mantle-testnet.public.blastapi.io'),
    ]),
  },
  ssr: false,
});
