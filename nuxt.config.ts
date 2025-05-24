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
  
  // Настройки Supabase - исправление на основе официальной документации
  supabase: {
    redirect: false,
    // Критически важно для dev режима - основано на GitHub issue #264
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      sameSite: 'lax',
      // Исправление для Safari и Chrome в dev режиме
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false, // Позволяет JS доступ к cookies
    },
    clientOptions: {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        // Исправление для localStorage persistence
        storageKey: 'sb-auth-token',
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