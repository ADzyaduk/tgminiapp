export default defineNuxtConfig({
  // Базовые настройки
  // SSR включен - переменные окружения будут доступны на сервере через runtimeConfig
  // Это решает проблему с переменными окружения в Amvera Cloud
  ssr: true,
  compatibilityDate: '2025-05-05',

  // Важные модули
  modules: [
    '@nuxt/ui',
    '@pinia/nuxt',
    '@nuxtjs/supabase',
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

  // Переменные окружения
  // В production runtimeConfig подхватывает только переменные с префиксом NUXT_PUBLIC_
  // Модуль @nuxtjs/supabase ищет SUPABASE_URL и SUPABASE_KEY напрямую в process.env
  runtimeConfig: {
    // Серверные секреты (доступны только на сервере)
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,

    // Публичные переменные (доступны на клиенте и сервере)
    // Используем префикс NUXT_PUBLIC_ для production
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '',
      telegramBotToken: process.env.NUXT_PUBLIC_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
      disableRealtime: process.env.NUXT_PUBLIC_DISABLE_REALTIME || process.env.DISABLE_REALTIME || 'false',
      isTelegramDevMode: process.env.NODE_ENV === 'development'
    },
  },

  // Настройки Supabase модуля
  // Модуль автоматически использует SUPABASE_URL и SUPABASE_KEY из process.env
  // При SSR переменные доступны во время выполнения на сервере
  supabase: {
    redirect: false,
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    clientOptions: {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      }
    }
  },

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

})
