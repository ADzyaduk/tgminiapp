// Серверный плагин Nitro - выполняется при инициализации сервера
// Устанавливает переменные окружения из runtimeConfig в process.env
// Это необходимо, потому что модуль @nuxtjs/supabase ищет переменные напрямую в process.env

export default defineNitroPlugin((nitroApp) => {
  // Получаем runtimeConfig
  const config = useRuntimeConfig()
  
  // Устанавливаем переменные из runtimeConfig в process.env
  // если они там отсутствуют (для совместимости с модулем @nuxtjs/supabase)
  if (config.public.supabaseUrl && !process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = config.public.supabaseUrl
    console.log('✅ SUPABASE_URL установлен из runtimeConfig')
  }
  
  if (config.public.supabaseAnonKey) {
    if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_ANON_KEY) {
      process.env.SUPABASE_KEY = config.public.supabaseAnonKey
      process.env.SUPABASE_ANON_KEY = config.public.supabaseAnonKey
      console.log('✅ SUPABASE_KEY установлен из runtimeConfig')
    }
  }
  
  // Проверяем наличие переменных
  const supabaseUrl = config.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseKey = config.public.supabaseAnonKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    const missing = []
    if (!supabaseUrl) missing.push('SUPABASE_URL')
    if (!supabaseKey) missing.push('SUPABASE_KEY или SUPABASE_ANON_KEY')
    
    console.error('❌ Supabase не настроен на сервере!')
    console.error(`Отсутствуют переменные окружения: ${missing.join(', ')}`)
    console.error('Пожалуйста, добавьте эти переменные в Amvera Cloud и перезапустите контейнер')
  } else {
    console.log('✅ Supabase конфигурация найдена на сервере')
  }
})

