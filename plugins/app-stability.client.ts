export default defineNuxtPlugin(() => {
  if (!process.client) return;

  const router = useRouter();
  const nuxtApp = useNuxtApp();
  const { user, refreshUserSession, profile } = useAuth(); // Предполагаем, что у вас есть useAuth() composable

  const MAX_INACTIVITY_MS = 5 * 60 * 1000; // 5 минут простоя
  const NAVIGATION_TIMEOUT_MS = 20000; // Увеличим таймаут навигации до 20 секунд
  const FETCH_TIMEOUT_MS = 30000; // 30 секунд на HTTP запрос
  const MAX_NAVIGATION_FAILURES_BEFORE_RELOAD = 2;

  let lastActivityTime = Date.now();
  let navigationTimeoutId: NodeJS.Timeout | null = null;
  let isCurrentlyNavigating = false;
  let navigationFailures = 0;

  const resetStoresState = () => {
    console.log('🔄 Сброс состояния Pinia stores...');
    if (nuxtApp.$pinia) {
      for (const storeName in nuxtApp.$pinia.state.value) {
        const store = nuxtApp.$pinia.state.value[storeName];
        if (store && typeof store.$reset === 'function') {
          try {
            store.$reset();
            console.log(`Store ${storeName} успешно сброшен.`);
          } catch (e) {
            console.warn(`Не удалось сбросить store ${storeName}:`, e);
          }
        }
      }
    }
  };

  const handleAppResume = async () => {
    console.log('🚀 Приложение возобновляет работу после возможного простоя.');
    lastActivityTime = Date.now();

    // 1. Обновить сессию пользователя
    if (user.value) { // Если пользователь был залогинен
      try {
        console.log('Обновление сессии пользователя...');
        await refreshUserSession(); // Ваша функция для обновления сессии
        console.log('Сессия пользователя успешно обновлена.');
      } catch (error) {
        console.warn('Не удалось обновить сессию пользователя:', error);
        // Возможно, стоит перенаправить на логин или показать сообщение
      }
    }

    // 2. Сбросить состояние сторов, чтобы данные перезагрузились
    resetStoresState();

    // 3. Перезагрузить текущую страницу, чтобы точно получить свежие данные
    // Это более агрессивный, но часто эффективный метод
    console.warn('Перезагрузка текущей страницы для получения свежих данных после простоя...');
    router.go(0); // Перезагружает текущий маршрут
  };

  // Отслеживание активности пользователя
  const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  activityEvents.forEach(event => {
    window.addEventListener(event, () => {
      const now = Date.now();
      if (now - lastActivityTime > MAX_INACTIVITY_MS / 2) { // Если прошло больше половины времени простоя
         // Проверяем, не было ли перед этим длительного простоя
        if (Date.now() - lastActivityTime > MAX_INACTIVITY_MS) {
            handleAppResume();
        }
      }
      lastActivityTime = now;
    });
  });

  // Проверка при изменении видимости вкладки (возвращение на вкладку)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastActivityTime > MAX_INACTIVITY_MS) {
        console.log('Возвращение на вкладку после длительного простоя.');
        handleAppResume();
      }
      lastActivityTime = Date.now(); // Обновляем время активности при возвращении на вкладку
    }
  });

  // --- Мониторинг роутера и fetch (оставляем, но с фокусом на простое) ---
  const forceAppReload = (reason: string) => {
    console.warn(`🔄 Принудительная перезагрузка приложения. Причина: ${reason}`);
    window.location.reload();
  };

  router.beforeEach((to, from) => {
    // Проверяем простой перед началом навигации
    if (Date.now() - lastActivityTime > MAX_INACTIVITY_MS) {
      console.log('Начало навигации после длительного простоя.');
      // Вместо handleAppResume, чтобы не было двойной перезагрузки,
      // просто сбрасываем сторы. Сессия должна была обновиться по visibilitychange/activity.
      resetStoresState(); 
    }
    lastActivityTime = Date.now(); // Обновляем активность при навигации

    if (isCurrentlyNavigating) {
      if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    }
    isCurrentlyNavigating = true;

    navigationTimeoutId = setTimeout(() => {
      console.error(`❌ Навигация на "${to.fullPath}" заняла слишком много времени (${NAVIGATION_TIMEOUT_MS}ms).`);
      isCurrentlyNavigating = false;
      navigationFailures++;
      if (navigationFailures >= MAX_NAVIGATION_FAILURES_BEFORE_RELOAD) {
        forceAppReload(`слишком много неудачных навигаций (${navigationFailures})`);
      } else {
        console.warn(`Попытка прямого перехода (window.location) на: ${to.fullPath}`);
        window.location.href = to.fullPath;
      }
    }, NAVIGATION_TIMEOUT_MS);
  });

  router.afterEach(() => {
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    isCurrentlyNavigating = false;
    navigationFailures = 0;
    lastActivityTime = Date.now(); // Обновляем активность
  });

  router.onError((error) => {
    console.error('🚨 Ошибка роутера:', error);
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    isCurrentlyNavigating = false;
    navigationFailures++;
    if (navigationFailures >= MAX_NAVIGATION_FAILURES_BEFORE_RELOAD) {
      forceAppReload(`ошибка роутера и ${navigationFailures} неудачных попыток`);
    }
  });

  const originalFetch = window.fetch;
  const activeFetchControllers = new Set<AbortController>();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Проверяем простой перед fetch
    if (Date.now() - lastActivityTime > MAX_INACTIVITY_MS) {
        console.log('Fetch запрос после длительного простоя. Сбрасываем состояние...');
        // Не вызываем handleAppResume, чтобы не было рекурсивных перезагрузок, если fetch является частью handleAppResume
        resetStoresState();
        if(user.value) await refreshUserSession(); // Попытка обновить сессию перед важным запросом
    }
    lastActivityTime = Date.now(); // Обновляем активность при fetch

    const controller = new AbortController();
    activeFetchControllers.add(controller);
    const fetchTimeoutId = setTimeout(() => {
      console.warn(`⚠️ Fetch запрос на "${String(input)}" отменен по таймауту (${FETCH_TIMEOUT_MS}ms).`);
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
      const response = await originalFetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      // ... (обработка ошибок fetch остается такой же)
      if (error.name === 'AbortError') {
        console.log(`Fetch запрос на "${String(input)}" был отменен.`);
      } else {
        console.error(`Fetch ошибка для "${String(input)}":`, error);
      }
      throw error;
    } finally {
      clearTimeout(fetchTimeoutId);
      activeFetchControllers.delete(controller);
    }
  };
  
  router.beforeEach(() => {
    if (activeFetchControllers.size > 7) { // Немного увеличил порог
      console.warn(`Обнаружено ${activeFetchControllers.size} активных fetch запросов перед навигацией. Отменяем...`);
      activeFetchControllers.forEach(controller => controller.abort());
      activeFetchControllers.clear();
    }
  });

  // Health check интервал оставляем для общего мониторинга, но основной фокус на простое
  const healthCheckIntervalId = setInterval(() => {
    const now = Date.now();
    if (isCurrentlyNavigating && (now - lastActivityTime) > NAVIGATION_TIMEOUT_MS + 10000) { // +10 сек буфер
        console.warn('Обнаружена потенциально зависшая навигация (health check).');
        if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
         navigationFailures++;
         isCurrentlyNavigating = false; 
         if (navigationFailures >= MAX_NAVIGATION_FAILURES_BEFORE_RELOAD) {
            forceAppReload(`зависшая навигация (health check, ${navigationFailures})`);
         } else {
            router.push('/'); 
         }
    }
  }, NAVIGATION_TIMEOUT_MS * 2); // Проверяем реже, но достаточно часто

  window.addEventListener('beforeunload', () => {
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    clearInterval(healthCheckIntervalId);
    activeFetchControllers.forEach(controller => controller.abort());
  });

  console.log('🛡️ Плагин стабильности приложения (v2 - фокус на простое) запущен.');
}); 