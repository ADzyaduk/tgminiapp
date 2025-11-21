export default defineNuxtPlugin(() => {
  // Этот плагин работает и на сервере, и на клиенте
  // Выполняется первым (00- префикс) для установки переменных до инициализации модуля Supabase
  // Устанавливаем переменные окружения из runtimeConfig в process.env на сервере
  // Это необходимо, потому что модуль @nuxtjs/supabase ищет переменные напрямую в process.env
  
  const config = useRuntimeConfig()
  
  if (process.server) {
    // На сервере устанавливаем переменные из runtimeConfig в process.env
    // если они там отсутствуют (для совместимости с модулем @nuxtjs/supabase)
    if (config.public.supabaseUrl && !process.env.SUPABASE_URL) {
      process.env.SUPABASE_URL = config.public.supabaseUrl
    }
    
    if (config.public.supabaseAnonKey) {
      if (!process.env.SUPABASE_KEY && !process.env.SUPABASE_ANON_KEY) {
        process.env.SUPABASE_KEY = config.public.supabaseAnonKey
        process.env.SUPABASE_ANON_KEY = config.public.supabaseAnonKey
      }
    }
  }
  
  // Проверяем наличие переменных Supabase
  const supabaseUrl = config.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseKey = config.public.supabaseAnonKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    const missing = []
    if (!supabaseUrl) missing.push('SUPABASE_URL')
    if (!supabaseKey) missing.push('SUPABASE_KEY или SUPABASE_ANON_KEY')
    
    const errorMsg = `❌ Supabase не настроен! Отсутствуют переменные окружения: ${missing.join(', ')}`
    
    if (process.server) {
      // На сервере выводим в консоль
      console.error(errorMsg)
      console.error('Пожалуйста, добавьте эти переменные в Amvera Cloud и перезапустите контейнер')
    } else {
      // На клиенте выводим в консоль браузера
      console.error(errorMsg)
      console.error('Пожалуйста, обратитесь к администратору')
    }
  } else {
    if (process.server) {
      console.log('✅ Supabase конфигурация найдена на сервере')
    } else {
      console.log('✅ Supabase конфигурация найдена на клиенте')
    }
  }
})

