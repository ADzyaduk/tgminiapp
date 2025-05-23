export default defineNuxtRouteMiddleware((to, from) => {
  const { user, loading } = useAuth()
  
  // Если еще загружается, ждем
  if (loading.value) {
    return
  }
  
  // Если пользователь не авторизован, редиректим на логин
  if (!user.value) {
    return navigateTo('/login')
  }
}) 