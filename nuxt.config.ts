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
  // В production runtimeConfig подхватывает только переменные с префиксом NUXT_ (серверные) или NUXT_PUBLIC_ (публичные)
  // Модуль @nuxtjs/supabase ищет переменные напрямую в process.env во время выполнения
  runtimeConfig: {
    // Серверные секреты (доступны только на сервере)
    // Используем префикс NUXT_ для серверных переменных в production
    jwtSecret: process.env.NUXT_JWT_SECRET || process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.NUXT_JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET,
    telegramBotToken: process.env.NUXT_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
    supabaseServiceKey: process.env.NUXT_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY,

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
  // SUPABASE_SERVICE_KEY используется для serverSupabaseServiceRole
  // В production переменные доступны через process.env во время выполнения
  supabase: {
    redirect: false,
    // serviceKey: модуль автоматически ищет SUPABASE_SERVICE_KEY в process.env
    // НЕ используем NUXT_PUBLIC_ для service key - это серверный секрет!
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
