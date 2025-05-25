export const useCleanup = () => {
  const cleanupTasks: (() => void)[] = []
  
  // Добавить задачу очистки
  const addCleanupTask = (task: () => void) => {
    cleanupTasks.push(task)
  }
  
  // Очистить все ресурсы
  const cleanup = () => {
    cleanupTasks.forEach(task => {
      try {
        task()
      } catch (error) {
        console.warn('Ошибка при очистке ресурса:', error)
      }
    })
    cleanupTasks.length = 0
  }
  
  // Автоматическая очистка при размонтировании
  onUnmounted(() => {
    cleanup()
  })
  
  // Хелперы для часто используемых ресурсов
  const registerInterval = (intervalId: number) => {
    addCleanupTask(() => clearInterval(intervalId))
    return intervalId
  }
  
  const registerTimeout = (timeoutId: number) => {
    addCleanupTask(() => clearTimeout(timeoutId))
    return timeoutId
  }
  
  const registerEventListener = (
    element: EventTarget, 
    event: string, 
    handler: EventListener, 
    options?: boolean | AddEventListenerOptions
  ) => {
    element.addEventListener(event, handler, options)
    addCleanupTask(() => element.removeEventListener(event, handler, options))
  }
  
  const registerAbortController = () => {
    const controller = new AbortController()
    addCleanupTask(() => controller.abort())
    return controller
  }
  
  return {
    addCleanupTask,
    cleanup,
    registerInterval,
    registerTimeout,
    registerEventListener,
    registerAbortController
  }
} 