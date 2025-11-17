export default defineNuxtConfig({
  // Базовые настройки
  ssr: false, // Отключаем SSR для упрощения
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

  // Настройки Supabase - упрощенная конфигурация
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

  // Переменные окружения
  runtimeConfig: {
    // Серверные секреты
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY,

    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_KEY,
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      disableRealtime: process.env.DISABLE_REALTIME || 'false',
      isTelegramDevMode: process.env.NODE_ENV === 'development'
    },
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
  }
})
