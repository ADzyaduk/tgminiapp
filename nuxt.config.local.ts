// Конфигурация для локальной разработки
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@pinia/nuxt', '@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  // Конфигурация Supabase
  supabase: {
    // @ts-ignore
    redirect: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/register', '/'],
    },
  },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_KEY,
      telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
      // Режим разработки без Telegram
      isTelegramDevMode: true
    },
  },
  // Отключаем SSR для локальной разработки, чтобы избежать ошибок с Telegram SDK
  ssr: false
}) 