export default defineNuxtPlugin(async (nuxtApp) => {
  // Инициализируем аутентификацию только на клиенте
  const { initializeAuth, initializing } = useAuth()
  
  // Ждем инициализации
  await initializeAuth()
  
  // Добавляем хук для ожидания инициализации
  nuxtApp.hook('app:beforeMount', () => {
    // Убеждаемся что инициализация завершена перед монтированием
    return new Promise((resolve) => {
      const checkInitialization = () => {
        if (!initializing.value) {
          resolve(true)
        } else {
          setTimeout(checkInitialization, 10)
        }
      }
      checkInitialization()
    })
  })
}) 