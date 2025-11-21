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

  // Настройки Supabase
  // Явно указываем переменные из runtimeConfig для надежности
  // Модуль будет использовать эти значения, если они доступны
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

  // Nitro hooks для установки переменных окружения до инициализации модулей
  nitro: {
    hooks: {
      'nitro:init'(nitro: any) {
        // Устанавливаем переменные из runtimeConfig в process.env
        // Это выполняется при инициализации Nitro, до загрузки модулей
        const config = nitro.options.runtimeConfig
        
        if (config?.public?.supabaseUrl && !process.env.SUPABASE_URL) {
          process.env.SUPABASE_URL = config.public.supabaseUrl
        }
        
        if (config?.public?.supabaseAnonKey) {
          if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_ANON_KEY) {
            process.env.SUPABASE_KEY = config.public.supabaseAnonKey
            process.env.SUPABASE_ANON_KEY = config.public.supabaseAnonKey
          }
        }
      }
    } as any
  }
})
