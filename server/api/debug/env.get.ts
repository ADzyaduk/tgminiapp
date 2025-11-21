// Тестовый endpoint для проверки переменных окружения
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  
  return {
    // Проверяем переменные в process.env (доступны на сервере)
    processEnv: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Установлен' : '❌ Не установлен',
      SUPABASE_KEY: process.env.SUPABASE_KEY ? '✅ Установлен' : '❌ Не установлен',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✅ Установлен' : '❌ Не установлен',
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Не установлен',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Установлен' : '❌ Не установлен',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? '✅ Установлен' : '❌ Не установлен',
    },
    // Проверяем переменные в runtimeConfig
    runtimeConfig: {
      supabaseUrl: config.public.supabaseUrl ? '✅ Установлен' : '❌ Не установлен',
      supabaseAnonKey: config.public.supabaseAnonKey ? '✅ Установлен' : '❌ Не установлен',
      telegramBotToken: config.public.telegramBotToken ? '✅ Установлен' : '❌ Не установлен',
    },
    // Длины (для проверки, что значения не пустые)
    lengths: {
      SUPABASE_URL: process.env.SUPABASE_URL?.length || 0,
      SUPABASE_KEY: process.env.SUPABASE_KEY?.length || 0,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY?.length || 0,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.length || 0,
      JWT_SECRET: process.env.JWT_SECRET?.length || 0,
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY?.length || 0,
      runtimeConfigUrl: config.public.supabaseUrl?.length || 0,
      runtimeConfigKey: config.public.supabaseAnonKey?.length || 0,
      runtimeConfigTelegramToken: config.public.telegramBotToken?.length || 0,
    },
    // Вывод: если TELEGRAM_BOT_TOKEN работает, значит переменные доступны в process.env
    conclusion: {
      telegramWorks: !!process.env.TELEGRAM_BOT_TOKEN,
      supabaseWorks: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)),
      problemIsSupabaseModule: !!process.env.TELEGRAM_BOT_TOKEN && !(process.env.SUPABASE_URL && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY))
    }
  }
})

