// Тестовый endpoint для проверки переменных окружения
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  
  return {
    // Проверяем переменные в process.env
    processEnv: {
      SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Установлен' : '❌ Не установлен',
      SUPABASE_KEY: process.env.SUPABASE_KEY ? '✅ Установлен' : '❌ Не установлен',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? '✅ Установлен' : '❌ Не установлен',
    },
    // Проверяем переменные в runtimeConfig
    runtimeConfig: {
      supabaseUrl: config.public.supabaseUrl ? '✅ Установлен' : '❌ Не установлен',
      supabaseAnonKey: config.public.supabaseAnonKey ? '✅ Установлен' : '❌ Не установлен',
    },
    // Длины (для проверки, что значения не пустые)
    lengths: {
      SUPABASE_URL: process.env.SUPABASE_URL?.length || 0,
      SUPABASE_KEY: process.env.SUPABASE_KEY?.length || 0,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY?.length || 0,
      runtimeConfigUrl: config.public.supabaseUrl?.length || 0,
      runtimeConfigKey: config.public.supabaseAnonKey?.length || 0,
    }
  }
})

