const get = (key: string, fallback = '') => {
  const val = import.meta.env[key];
  return typeof val === 'string' && val.trim() !== '' ? val.trim() : fallback;
};

export const env = {
  // ── Anthropic ──────────────────────────────────────────────────────────────
  // API key is intentionally omitted here — all Claude calls must go through
  // aria-server (VITE_API_URL) so the key never ships in the browser bundle.
  ANTHROPIC_MODEL:   get('VITE_ANTHROPIC_MODEL', 'claude-sonnet-4-6'),
  ANTHROPIC_VERSION: get('VITE_ANTHROPIC_VERSION', '2023-06-01'),
  ANTHROPIC_API_URL: get('VITE_ANTHROPIC_API_URL', 'https://api.anthropic.com/v1/messages'),

  // ── WalletConnect ──────────────────────────────────────────────────────────
  WALLETCONNECT_PROJECT_ID: get('VITE_WALLETCONNECT_PROJECT_ID', 'aria-rwa-mantle'),

  // ── Vault contract addresses (fill after deployment) ───────────────────────
  VAULT_ADDRESS_MAINNET:   get('VITE_VAULT_ADDRESS_MAINNET',   '0x0000000000000000000000000000000000000000'),
  VAULT_ADDRESS_TESTNET:   get('VITE_VAULT_ADDRESS_TESTNET',   '0x0000000000000000000000000000000000000000'),
  FACTORY_ADDRESS_MAINNET: get('VITE_FACTORY_ADDRESS_MAINNET', '0x0000000000000000000000000000000000000000'),
  FACTORY_ADDRESS_TESTNET: get('VITE_FACTORY_ADDRESS_TESTNET', '0x0000000000000000000000000000000000000000'),

  // ── Token addresses ────────────────────────────────────────────────────────
  // Mainnet: official Mantle protocol addresses (stable, no env override needed)
  WETH_ADDRESS_MAINNET: get('VITE_WETH_ADDRESS_MAINNET', '0xdEAddEaDdeadDEadDEADDEaDDeaDDeAD00000000'),
  USDC_ADDRESS_MAINNET: get('VITE_USDC_ADDRESS_MAINNET', '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9'),
  // Testnet: deploy mocks and fill these in
  WETH_ADDRESS_TESTNET: get('VITE_WETH_ADDRESS_TESTNET', '0x0000000000000000000000000000000000000000'),
  USDC_ADDRESS_TESTNET: get('VITE_USDC_ADDRESS_TESTNET', '0x0000000000000000000000000000000000000000'),

  // ── RPC URLs ───────────────────────────────────────────────────────────────
  MANTLE_RPC_URL:         get('VITE_MANTLE_RPC_URL',         'https://rpc.mantle.xyz'),
  MANTLE_TESTNET_RPC_URL: get('VITE_MANTLE_TESTNET_RPC_URL', 'https://rpc.sepolia.mantle.xyz'),

  // ── Explorer URLs ──────────────────────────────────────────────────────────
  MANTLE_EXPLORER_URL:         get('VITE_MANTLE_EXPLORER_URL',         'https://explorer.mantle.xyz'),
  MANTLE_TESTNET_EXPLORER_URL: get('VITE_MANTLE_TESTNET_EXPLORER_URL', 'https://explorer.sepolia.mantle.xyz'),

  // ── Proxy server (aria-server) ─────────────────────────────────────────────
  // All Claude API calls are routed through this to enforce rate limits.
  API_URL: get('VITE_API_URL', ''),

  // ── Agent feed server (aria-agent) ────────────────────────────────────────
  // Set to http://localhost:3001 (or your VPS address) to enable live feed.
  FEED_URL: get('VITE_FEED_URL', ''),

  // ── App ────────────────────────────────────────────────────────────────────
  APP_NAME: get('VITE_APP_NAME', 'ARIA'),
} as const;
