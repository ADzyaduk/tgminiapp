export default defineNuxtPlugin(async () => {
  const { initializeAuth } = useAuth()
  
  // Показываем debug информацию в dev режиме
  if (import.meta.dev) {
    const { debugAuth } = await import('~/utils/authDebug')
    debugAuth()
  }
  
  // Инициализируем авторизацию только на клиенте
  await initializeAuth()
}) 