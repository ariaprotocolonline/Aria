module.exports = {
  apps: [
    {
      name:               'aria-server',
      script:             './aria-server/dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT:     3002,
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
        NODE_ENV: 'production',
      },
      error_file:         './logs/aria-agent-error.log',
      out_file:           './logs/aria-agent-out.log',
      kill_timeout:       5000,
      max_memory_restart: '256M',
    },
  ],
};
