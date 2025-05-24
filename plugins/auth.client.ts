export default defineNuxtPlugin(async () => {
  // Инициализируем аутентификацию только на клиенте
  const { initializeAuth, initializing } = useAuth()
  
  // Ждем инициализации
  await initializeAuth()
}) 