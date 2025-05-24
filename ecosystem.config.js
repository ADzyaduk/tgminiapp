module.exports = {
  apps: [
    {
      name: 'nuxtminiapp',
      port: '3000',
      exec_mode: 'cluster',
      instances: 'max', // Или укажите конкретное число, например 2
      script: './server/index.mjs',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Автоматический перезапуск при изменениях
      watch: false,
      // Максимальный объем памяти (в MB)
      max_memory_restart: '1G',
      // Логи
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      // Время ожидания перед принудительным завершением
      kill_timeout: 5000,
      // Автоматический перезапуск при сбоях
      autorestart: true,
      // Максимальное количество перезапусков
      max_restarts: 10,
      // Минимальное время работы перед перезапуском
      min_uptime: '10s'
    }
  ]
} 