export default defineNuxtPlugin(() => {
  if (!process.client) return

  const router = useRouter()
  
  // Счетчики для мониторинга
  let navigationCount = 0
  let lastNavigationTime = Date.now()
  
  // Очистка при каждой навигации
  router.beforeEach((to, from) => {
    navigationCount++
    lastNavigationTime = Date.now()
    
    // Очищаем неиспользуемые объекты каждые 10 навигаций
    if (navigationCount % 10 === 0) {
      // Принудительная сборка мусора (если доступна)
      if (window.gc) {
        window.gc()
      }
      
      // Очищаем кэши изображений
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('image') || name.includes('static')) {
              caches.delete(name)
            }
          })
        })
      }
    }
  })
  
  // Автоматическая очистка каждые 5 минут
  const cleanupInterval = setInterval(() => {
    const timeSinceLastNav = Date.now() - lastNavigationTime
    
    // Если долго не было навигации, делаем мягкую очистку
    if (timeSinceLastNav > 5 * 60 * 1000) { // 5 минут
      console.log('🧹 Автоматическая очистка памяти...')
      
      // Очищаем Pinia stores (сбрасываем кэши, но не состояние)
      const { $pinia } = useNuxtApp()
      if ($pinia) {
        Object.values($pinia.state.value).forEach((store: any) => {
          // Очищаем только кэшированные данные, не основное состояние
          if (store && typeof store.$patch === 'function') {
            // Сбрасываем флаги загрузки
            store.$patch({
              loading: false,
              error: null
            })
          }
        })
      }
      
      // Принудительная сборка мусора
      if (window.gc) {
        window.gc()
      }
    }
  }, 5 * 60 * 1000) // Каждые 5 минут
  
  // Очистка при закрытии страницы
  window.addEventListener('beforeunload', () => {
    clearInterval(cleanupInterval)
  })
  
  // Мониторинг производительности
  if (performance.memory) {
    const memoryCheckInterval = setInterval(() => {
      const used = performance.memory.usedJSHeapSize / 1024 / 1024
      const limit = performance.memory.jsHeapSizeLimit / 1024 / 1024
      
      // Если использование памяти превышает 80%, делаем агрессивную очистку
      if (used > limit * 0.8) {
        console.warn('⚠️ Высокое использование памяти, выполняю очистку...')
        
        // Очищаем все кэши
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name))
          })
        }
        
        // Принудительная сборка мусора
        if (window.gc) {
          window.gc()
        }
        
        // В крайнем случае - мягкая перезагрузка
        if (used > limit * 0.9) {
          console.warn('🔄 Критическое использование памяти, выполняю мягкую перезагрузку...')
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        }
      }
    }, 60000) // Каждую минуту
    
    // Очистка при закрытии
    window.addEventListener('beforeunload', () => {
      clearInterval(memoryCheckInterval)
    })
  }
  
  console.log('🧹 Система автоматической очистки памяти запущена')
}) 