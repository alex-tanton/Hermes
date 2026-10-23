module.exports = {
  apps: [
    {
      name: 'referral-repeater',
      script: './dist/cli/index.js',
      args: 'daemon',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      output: './logs/pm2-out.log',
      error: './logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
