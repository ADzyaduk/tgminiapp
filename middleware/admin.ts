export default defineNuxtRouteMiddleware(async (to, from) => {
  const { user, profile, isAdmin, isManager, initializing } = useAuth()
  
  // Ждем завершения инициализации с таймаутом
  let waitTime = 0
  const maxWaitTime = 5000 // 5 секунд максимум
  
  while (initializing.value && waitTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 50))
    waitTime += 50
  }
  
  // Если инициализация не завершилась, логируем предупреждение
  if (initializing.value) {
    console.warn('Auth initialization timeout, proceeding anyway')
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