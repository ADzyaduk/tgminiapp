export default defineNuxtConfig({
  // Базовые настройки
  // SSR включен - переменные окружения будут доступны на сервере через runtimeConfig
  // Это решает проблему с переменными окружения в Amvera Cloud
  ssr: true,
  compatibilityDate: '2025-05-05',

  // Важные модули
  // Временно отключаем @nuxtjs/supabase, чтобы использовать свой composable
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    // '@nuxtjs/supabase', // Временно отключен - используем свой composable
  ],

  // Настройки Nuxt UI
  ui: {
    // Отключаем загрузку шрифтов из fontshare
    fonts: false
  },

  // Стили
  css: ['~/assets/css/main.css'],

  // Head настройки - добавляем Telegram WebApp скрипт
  app: {
    head: {
      script: [
        {
          src: 'https://telegram.org/js/telegram-web-app.js',
          defer: true
        }
      ]
    }
  },

  // Переменные окружения - сначала определяем runtimeConfig
  runtimeConfig: {
    // Серверные секреты (доступны только на сервере)
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,

    // Публичные переменные (доступны на клиенте и сервере)
    public: {
      // Поддерживаем оба варианта имен переменных для Supabase
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '',
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
      disableRealtime: process.env.DISABLE_REALTIME || 'false',
      isTelegramDevMode: process.env.NODE_ENV === 'development'
    },
  },

  // Модуль @nuxtjs/supabase временно отключен
  // Используем свой composable useSupabaseClient, который читает переменные из runtimeConfig

  // Настройки Vite
  vite: {
    resolve: {
      alias: {
        cookie: 'cookie-es'
      }
    },
    server: {
      fs: {
        strict: false
      }
    }
  },

  // Nitro alias для совместимости с модулем @nuxtjs/supabase
  nitro: {
    alias: {
      '#supabase/server': '~/server/utils/supabase'
    }
  },

})
