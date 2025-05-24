export default defineNuxtRouteMiddleware(async (to, from) => {
  // Выполняем только на клиенте
  if (process.server) return

  const { user, initializing } = useAuth()
  
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
  
    if (import.meta.dev) {    console.log('Auth middleware check:', {      hasUser: !!user.value,      userEmail: user.value?.email,      initializing: initializing.value    })  }
  
  // Если пользователь не авторизован, перенаправляем на логин
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
}) 