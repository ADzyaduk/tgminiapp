export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  // Проверяем наличие переменных Supabase
  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseAnonKey
  
  if (!supabaseUrl || !supabaseKey) {
    const missing = []
    if (!supabaseUrl) missing.push('SUPABASE_URL')
    if (!supabaseKey) missing.push('SUPABASE_KEY или SUPABASE_ANON_KEY')
    
    console.error('❌ Supabase не настроен!')
    console.error(`Отсутствуют переменные окружения: ${missing.join(', ')}`)
    console.error('Пожалуйста, добавьте эти переменные в Amvera Cloud:')
    console.error('1. Перейдите в настройки проекта в Amvera Cloud')
    console.error('2. Добавьте переменные окружения:')
    missing.forEach(env => console.error(`   - ${env}`))
    console.error('3. Пересоберите проект')
    
    // Показываем пользователю понятное сообщение
    if (process.client) {
      const errorMsg = `Ошибка конфигурации: отсутствуют переменные окружения ${missing.join(', ')}. Пожалуйста, обратитесь к администратору.`
      
      // Показываем ошибку в консоли браузера
      console.error(errorMsg)
      
      // Можно также показать уведомление пользователю
      // Но лучше не показывать технические детали конечным пользователям
    }
  } else {
    console.log('✅ Supabase конфигурация найдена')
    console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`)
    console.log(`   Key: ${supabaseKey.substring(0, 20)}...`)
  }
})

