export default defineNuxtRouteMiddleware((to, from) => {
  // Выполняем только на клиенте
  if (process.server) return

  const { isAuthenticated, isLoading } = useTelegramAuth()

  // Ждем завершения инициализации
  if (isLoading.value) return

  // Редирект если не авторизован
  if (!isAuthenticated.value) {
    // Сохраняем путь для редиректа после авторизации
    const redirectPath = to.fullPath

    return navigateTo({
      path: '/',
      query: { redirect: redirectPath }
    })
  }
})
