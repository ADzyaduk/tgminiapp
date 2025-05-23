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
  
  // UI настройки
  ui: {
    icons: ['heroicons', 'lucide']
  },
  
  // Стили
  css: ['~/assets/css/main.css'],
  
  // Настройки Supabase - расширенные
  supabase: {
    redirect: false,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7 // 7 дней
    },
    clientOptions: {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: process.client ? window.localStorage : undefined,
        storageKey: 'supabase.auth.token'
      }
    }
  },
  
  // Переменные окружения
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_KEY,
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN
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