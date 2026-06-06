import { type Address } from 'viem';
import { env } from '../config/env';

export const MANTLE_MAINNET_ID = 5000;
export const MANTLE_TESTNET_ID = 5003;

export const VAULT_ADDRESS: Record<number, Address> = {
  [MANTLE_TESTNET_ID]: env.VAULT_ADDRESS_TESTNET as Address,
  [MANTLE_MAINNET_ID]: env.VAULT_ADDRESS_MAINNET as Address,
};

export const FACTORY_ADDRESS: Record<number, Address> = {
  [MANTLE_TESTNET_ID]: env.FACTORY_ADDRESS_TESTNET as Address,
  [MANTLE_MAINNET_ID]: env.FACTORY_ADDRESS_MAINNET as Address,
};

export const TOKEN_ADDRESSES: Record<number, Record<string, Address>> = {
  [MANTLE_MAINNET_ID]: {
    WETH: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111' as Address,
    USDC: '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9' as Address,
  },
  [MANTLE_TESTNET_ID]: {
    WETH: env.WETH_ADDRESS_TESTNET as Address,
    USDC: env.USDC_ADDRESS_TESTNET as Address,
  },
};

export const SUPPORTED_TOKENS = ['WETH', 'USDC'] as const;
export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];
