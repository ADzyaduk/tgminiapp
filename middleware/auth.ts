export default defineNuxtRouteMiddleware((to, from) => {
  // Выполняем только на клиенте
  if (process.server) return

  const { isLoggedIn, initializing } = useAuth()
  
  // Ждем инициализации аутентификации
  if (initializing.value) {
    // Можно показать загрузку или просто подождать
    return
  }
  
  // Если пользователь не авторизован, перенаправляем на логин
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
}) 