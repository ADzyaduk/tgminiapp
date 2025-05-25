export default defineNuxtPlugin(() => {
  if (!process.client) return;

  const router = useRouter();
  const nuxtApp = useNuxtApp();
  const { user, refreshUserSession } = useAuth(); 

  const MAX_INACTIVITY_MS = 5 * 60 * 1000; // 5 минут простоя до агрессивных действий
  const CHECK_INTERVAL_WHEN_ACTIVE_MS = 1 * 60 * 1000; // 1 минута для проверки, если вкладка активна
  const NAVIGATION_TIMEOUT_MS = 20000; 
  const FETCH_TIMEOUT_MS = 30000; 
  const MAX_NAVIGATION_FAILURES_BEFORE_RELOAD = 2;

  let lastActivityTime = Date.now();
  let lastVisibleTime = document.visibilityState === 'visible' ? Date.now() : 0;
  let navigationTimeoutId: NodeJS.Timeout | null = null;
  let isCurrentlyNavigating = false;
  let navigationFailures = 0;
  let appWasHidden = document.visibilityState !== 'visible';

  const resetStoresState = (reason: string) => {
    console.log(`🔄 Сброс состояния Pinia stores. Причина: ${reason}`);
    if (nuxtApp.$pinia) {
      for (const storeName in nuxtApp.$pinia.state.value) {
        const store = nuxtApp.$pinia.state.value[storeName];
        if (store && typeof store.$reset === 'function') {
          try {
            store.$reset();
            console.log(`  Store ${storeName} успешно сброшен.`);
          } catch (e) {
            console.warn(`  Не удалось сбросить store ${storeName}:`, e);
          }
        }
      }
    }
  };

  const performAppResumeActions = async (resumeReason: string) => {
    console.log(`🚀 Возобновление работы приложения. Причина: ${resumeReason}`);
    lastActivityTime = Date.now();
    lastVisibleTime = Date.now(); // Обновляем, так как приложение только что стало активным/видимым
    appWasHidden = false; // Сбрасываем флаг

    if (user.value) {
      try {
        console.log('  Обновление сессии пользователя...');
        await refreshUserSession(); 
        console.log('  Сессия пользователя успешно обновлена.');
      } catch (error) {
        console.warn('  Не удалось обновить сессию пользователя:', error);
      }
    }

    resetStoresState('возобновление работы после простоя/скрытия');
    
    console.warn('  Перезагрузка текущей страницы для обеспечения консистентности данных...');
    router.go(0); 
  };

  // Отслеживание активности пользователя (для lastActivityTime)
  const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  activityEvents.forEach(event => {
    window.addEventListener(event, () => {
      lastActivityTime = Date.now();
    }, { passive: true });
  });

  // Основной обработчик для visibilitychange
  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    if (document.visibilityState === 'visible') {
      console.log('Вкладка стала видимой.');
      const timeHidden = now - lastVisibleTime; // Время, которое вкладка была скрыта
      // Если вкладка была скрыта или если прошло много времени с последней активности
      // (даже если она была видима, но неактивна - например, другой скрин)
      if (appWasHidden || (now - lastActivityTime > MAX_INACTIVITY_MS)) {
        console.log(`  Вкладка была скрыта ${Math.round(timeHidden / 1000)}s или неактивна.`);
        performAppResumeActions('возвращение на видимую/активную вкладку');
      } else {
        // Вкладка стала видимой, но простой был недолгим, просто обновляем время
        lastVisibleTime = now;
        lastActivityTime = now; // Считаем это активностью
      }
    } else {
      console.log('Вкладка стала скрытой.');
      lastVisibleTime = now; // Запоминаем время, когда вкладка стала невидимой
      appWasHidden = true;
    }
  });

  // Периодическая проверка, если вкладка остается активной (видимой)
  // Помогает отловить случаи, когда visibilitychange не сработал или простой внутри видимой вкладки
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - lastActivityTime > MAX_INACTIVITY_MS) {
        console.log('Обнаружен длительный простой внутри активной вкладки.');
        performAppResumeActions('длительный простой в активной вкладке');
      }
    }
  }, CHECK_INTERVAL_WHEN_ACTIVE_MS);


  // --- Мониторинг роутера и fetch --- 
  const forceAppReloadOnError = (reason: string) => {
    console.warn(`🔄 Принудительная перезагрузка приложения из-за ошибки. Причина: ${reason}`);
    window.location.reload();
  };

  router.beforeEach((to, from) => {
    lastActivityTime = Date.now(); // Любая навигация - это активность
    if (isCurrentlyNavigating) {
      if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    }
    isCurrentlyNavigating = true;

    navigationTimeoutId = setTimeout(() => {
      console.error(`❌ Навигация на "${to.fullPath}" таймаут (${NAVIGATION_TIMEOUT_MS}ms).`);
      isCurrentlyNavigating = false;
      navigationFailures++;
      if (navigationFailures >= MAX_NAVIGATION_FAILURES_BEFORE_RELOAD) {
        forceAppReloadOnError(`слишком много неудачных навигаций (${navigationFailures})`);
      } else {
        window.location.href = to.fullPath;
      }
    }, NAVIGATION_TIMEOUT_MS);
  });

  router.afterEach(() => {
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    isCurrentlyNavigating = false;
    navigationFailures = 0;
    lastActivityTime = Date.now(); 
  });

  router.onError((error) => {
    console.error('🚨 Ошибка роутера:', error);
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    isCurrentlyNavigating = false;
    navigationFailures++;
    if (navigationFailures >= MAX_NAVIGATION_FAILURES_BEFORE_RELOAD) {
      forceAppReloadOnError(`ошибка роутера (${navigationFailures} неудач)`);
    }
  });

  const originalFetch = window.fetch;
  const activeFetchControllers = new Set<AbortController>();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    lastActivityTime = Date.now(); // Любой fetch - это активность
    const controller = new AbortController();
    activeFetchControllers.add(controller);
    const fetchTimeoutId = setTimeout(() => {
      console.warn(`⚠️ Fetch запрос "${String(input)}" таймаут (${FETCH_TIMEOUT_MS}ms).`);
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
      return await originalFetch(input, { ...init, signal: controller.signal });
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`Fetch "${String(input)}" был отменен.`);
      } else {
        console.error(`Fetch ошибка "${String(input)}":`, error);
      }
      throw error;
    } finally {
      clearTimeout(fetchTimeoutId);
      activeFetchControllers.delete(controller);
    }
  };
  
  router.beforeEach(() => {
    // Убрал отмену fetch запросов здесь, т.к. performAppResumeActions делает router.go(0)
    // и это само по себе должно прервать ненужные запросы.
    // Если оставить, может быть конфликт с запросами, инициированными performAppResumeActions.
  });

  // Очистка при закрытии вкладки
  window.addEventListener('beforeunload', () => {
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    // clearInterval для healthCheckIntervalId не нужен, т.к. он был удален
    activeFetchControllers.forEach(controller => controller.abort());
  });

  console.log('🛡️ Плагин стабильности приложения (v3 - фокус на пробуждении и простое) запущен.');
}); 