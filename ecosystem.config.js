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
const ANTHROPIC_API_KEY  = env.ANTHROPIC_API_KEY;
const CYCLE_INTERVAL_MS  = env.CYCLE_INTERVAL_MS || '300000';

module.exports = {
  apps: [
    {
      name:               'aria-server',
      script:             './aria-server/dist/index.js',
      env: {
        NODE_ENV:          'production',
        PORT:              3002,
        ANTHROPIC_API_KEY,
      },
      error_file:         './logs/aria-server-error.log',
      out_file:           './logs/aria-server-out.log',
      kill_timeout:       5000,
      max_memory_restart: '512M',
    },
    {
      name:               'aria-agent',
      script:             './aria-agent/dist/index.js',
      env: {
        NODE_ENV:          'production',
        ANTHROPIC_API_KEY,
        CYCLE_INTERVAL_MS,
      },
      error_file:         './logs/aria-agent-error.log',
      out_file:           './logs/aria-agent-out.log',
      kill_timeout:       5000,
      max_memory_restart: '256M',
    },
  ],
};
