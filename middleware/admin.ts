export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, profile, isAdmin, initializing } = useAuth()
  
  // Ждем завершения инициализации
  while (initializing.value) {
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  // Если пользователь не авторизован, перенаправляем на логин
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
  
  // Если пользователь не админ, перенаправляем на главную
  if (!isAdmin.value) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Доступ запрещен. Требуются права администратора.'
    })
  }
}) 