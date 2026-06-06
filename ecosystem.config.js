const fs   = require('fs');
const path = require('path');

function loadEnv(filePath) {
  const out = {};
  try {
    fs.readFileSync(filePath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
      if (m) out[m[1].trim()] = m[2].trim();
    });
  } catch (_) {}
  return out;
}

const env = loadEnv(path.join(__dirname, '.env'));

module.exports = {
  apps: [
    {
      name:               'aria-server',
      script:             './aria-server/dist/index.js',
      env: {
        NODE_ENV:          'production',
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        DEEPSEEK_API_KEY:  env.DEEPSEEK_API_KEY  || '',
        DEEPSEEK_MODEL:    env.DEEPSEEK_MODEL    || 'deepseek-chat',
        SERVER_PORT:       env.SERVER_PORT       || '3002',
        ALLOWED_ORIGINS:   env.ALLOWED_ORIGINS   || '',
        INTERNAL_SECRET:   env.INTERNAL_SECRET   || '',
        // AUTH_SECRET must be a stable 32-byte hex string — if unset, sessions
        // are invalidated on every PM2 restart. Generate with:
        //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        AUTH_SECRET:       env.AUTH_SECRET       || '',
      },
      error_file:         './logs/aria-server-error.log',
      out_file:           './logs/aria-server-out.log',
      kill_timeout:       5000,
      max_memory_restart: '512M',
      max_restarts:       10,
      min_uptime:         '10s',
    },
    {
      name:               'aria-agent',
      script:             './aria-agent/dist/index.js',
      env: {
        NODE_ENV:                    'production',
        ANTHROPIC_API_KEY:           env.ANTHROPIC_API_KEY,
        DEEPSEEK_API_KEY:            env.DEEPSEEK_API_KEY    || '',
        DEEPSEEK_MODEL:              env.DEEPSEEK_MODEL      || 'deepseek-chat',
        ANTHROPIC_MODEL:             env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        AGENT_PRIVATE_KEY:           env.AGENT_PRIVATE_KEY,
        VAULT_ADDRESS:               env.VAULT_ADDRESS,
        FACTORY_ADDRESS:             env.FACTORY_ADDRESS,
        MANTLE_NETWORK:              env.MANTLE_NETWORK       || 'mainnet',
        MANTLE_MAINNET_RPC:          env.MANTLE_MAINNET_RPC   || 'https://rpc.mantle.xyz',
        MANTLE_TESTNET_RPC:          env.MANTLE_TESTNET_RPC   || 'https://rpc.sepolia.mantle.xyz',
        MANTLE_RPC:                  env.MANTLE_RPC           || 'https://rpc.mantle.xyz',
        VITE_WETH_ADDRESS_TESTNET:   env.VITE_WETH_ADDRESS_TESTNET || '',
        VITE_USDC_ADDRESS_TESTNET:   env.VITE_USDC_ADDRESS_TESTNET || '',
        CYCLE_INTERVAL_MS:           env.CYCLE_INTERVAL_MS    || '300000',
        RISK_PROFILE:                env.RISK_PROFILE         || 'Balanced',
        FEED_PORT:                   env.FEED_PORT            || '3001',
        VAULT_OWNER_ADDRESS:         env.VAULT_OWNER_ADDRESS  || '',
        // Optional intelligence integrations — agent runs without them
        ELFA_API_KEY:                env.ELFA_API_KEY         || '',
        NANSEN_API_KEY:              env.NANSEN_API_KEY       || '',
        XSTOCKS_ENABLED:             env.XSTOCKS_ENABLED      || 'false',
        // Telegram internal notify endpoint
        INTERNAL_SECRET:             env.INTERNAL_SECRET      || '',
        ARIA_SERVER_URL:             env.ARIA_SERVER_URL      || 'http://127.0.0.1:3002',
      },
      error_file:         './logs/aria-agent-error.log',
      out_file:           './logs/aria-agent-out.log',
      kill_timeout:       5000,
      max_memory_restart: '256M',
      max_restarts:       10,
      min_uptime:         '10s',
    },
    {
      name:               'aria-tgbot',
      script:             './aria-tgbot/dist/index.js',
      env: {
        NODE_ENV:                       'production',
        TELEGRAM_BOT_TOKEN:             env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_BOT_USERNAME:          env.TELEGRAM_BOT_USERNAME          || 'AriaRWAbot',
        TELEGRAM_WEBHOOK_URL:           env.TELEGRAM_WEBHOOK_URL           || '',
        TG_PORT:                        env.TG_PORT                        || '3003',
        INTERNAL_SECRET:                env.INTERNAL_SECRET                || '',
        ARIA_SERVER_URL:                env.ARIA_SERVER_URL                || 'http://127.0.0.1:3002',
        VAULT_OWNER_ADDRESS:            env.VAULT_OWNER_ADDRESS            || '',
        // Chain config for live vault balance lookups
        FACTORY_ADDRESS:                env.FACTORY_ADDRESS                || '',
        VAULT_ADDRESS:                  env.VAULT_ADDRESS                  || '',
        MANTLE_RPC:                     env.MANTLE_RPC                     || 'https://rpc.mantle.xyz',
        MANTLE_TESTNET_RPC:             env.MANTLE_TESTNET_RPC             || 'https://rpc.sepolia.mantle.xyz',
        VITE_FACTORY_ADDRESS_TESTNET:   env.VITE_FACTORY_ADDRESS_TESTNET   || '',
        VITE_VAULT_ADDRESS_TESTNET:     env.VITE_VAULT_ADDRESS_TESTNET     || '',
        VITE_WETH_ADDRESS_MAINNET:      env.VITE_WETH_ADDRESS_MAINNET      || '',
        VITE_USDC_ADDRESS_MAINNET:      env.VITE_USDC_ADDRESS_MAINNET      || '',
        VITE_WETH_ADDRESS_TESTNET:      env.VITE_WETH_ADDRESS_TESTNET      || '',
        VITE_USDC_ADDRESS_TESTNET:      env.VITE_USDC_ADDRESS_TESTNET      || '',
      },
      error_file:         './logs/aria-tgbot-error.log',
      out_file:           './logs/aria-tgbot-out.log',
      kill_timeout:       5000,
      max_memory_restart: '128M',
      max_restarts:       10,
      min_uptime:         '10s',
    },
  ],
};
