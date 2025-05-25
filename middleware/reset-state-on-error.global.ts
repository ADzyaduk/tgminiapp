export default defineNuxtRouteMiddleware((to, from) => {
  if (process.server) return;

  // Этот middleware вызывается на клиенте при каждой навигации.
  // Мы можем использовать его для сброса состояния, если предыдущая навигация была проблемной
  // или если есть флаг, указывающий на необходимость сброса.

  const nuxtApp = useNuxtApp();

  // Пример: если есть query параметр ?resetState=true
  if (to.query.resetState === 'true') {
    console.log('Обнаружен флаг resetState, сбрасываем Pinia stores...');
    if (nuxtApp.$pinia) {
      for (const storeName in nuxtApp.$pinia.state.value) {
        const store = nuxtApp.$pinia.state.value[storeName];
        if (store && typeof store.$reset === 'function') {
          try {
            store.$reset();
          } catch (e) {
            console.warn(`Не удалось сбросить store ${storeName} в middleware:`, e);
          }
        }
      }
    }
    // Удаляем query параметр, чтобы не сбрасывать при обновлении
    const newQuery = { ...to.query };
    delete newQuery.resetState;
    return navigateTo({ path: to.path, query: newQuery, replace: true });
  }

  // Также можно добавить логику, которая проверяет состояние, 
  // установленное плагином app-stability, если это необходимо.
  // Например, если плагин установил window.__APP_NEEDS_STATE_RESET = true;
  // if (window.__APP_NEEDS_STATE_RESET) {
  //   delete window.__APP_NEEDS_STATE_RESET;
  //   // логика сброса...
  // }
}); 