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
    icons: ['heroicons', 'lucide'],
    global: true
  },
  
  // Стили
  css: ['~/assets/css/main.css'],
  
  // Настройки Supabase с правильными cookie опциями
  supabase: {
    redirect: false,
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // Исправляет проблемы с localhost
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