export default defineNuxtPlugin(() => {
  if (!process.client) return;

  const router = useRouter();
  const nuxtApp = useNuxtApp();

  let navigationTimeoutId: NodeJS.Timeout | null = null;
  let isCurrentlyNavigating = false;
  let navigationFailures = 0;
  const MAX_NAVIGATION_FAILURES = 3; // Максимум неудачных попыток навигации перед перезагрузкой
  const NAVIGATION_TIMEOUT_MS = 15000; // 15 секунд на навигацию
  const FETCH_TIMEOUT_MS = 30000; // 30 секунд на HTTP запрос

  const forceAppReload = (reason: string) => {
    console.warn(`🔄 Принудительная перезагрузка приложения. Причина: ${reason}`);
    window.location.reload();
  };

  // 1. Мониторинг роутера
  router.beforeEach((to, from) => {
    if (isCurrentlyNavigating) {
      console.warn('⚠️ Предыдущая навигация еще не завершена, отменяем таймер.');
      if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    }
    isCurrentlyNavigating = true;

    navigationTimeoutId = setTimeout(() => {
      console.error(`❌ Навигация на "${to.fullPath}" заняла слишком много времени.`);
      navigationFailures++;
      isCurrentlyNavigating = false; // Сбрасываем флаг

      if (navigationFailures >= MAX_NAVIGATION_FAILURES) {
        forceAppReload(`слишком много неудачных навигаций (${navigationFailures})`);
      } else {
        // Попытка перейти напрямую через window.location, может помочь если роутер "завис"
        console.warn(`Попытка прямого перехода на: ${to.fullPath}`);
        window.location.href = to.fullPath;
      }
    }, NAVIGATION_TIMEOUT_MS);
  });

  router.afterEach(() => {
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    isCurrentlyNavigating = false;
    navigationFailures = 0; // Сбрасываем счетчик при успешной навигации
  });

  router.onError((error) => {
    console.error('🚨 Ошибка роутера:', error);
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    isCurrentlyNavigating = false;
    navigationFailures++;
    if (navigationFailures >= MAX_NAVIGATION_FAILURES) {
      forceAppReload(`ошибка роутера и ${navigationFailures} неудачных попыток`);
    }
  });

  // 2. Мониторинг fetch запросов (обертка над window.fetch)
  const originalFetch = window.fetch;
  const activeFetchControllers = new Set<AbortController>();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
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
  
  // Отменяем все активные fetch запросы перед каждой навигацией, если их слишком много
   router.beforeEach(() => {
    if (activeFetchControllers.size > 5) { // Порог для количества "зависших" запросов
      console.warn(`Обнаружено ${activeFetchControllers.size} активных fetch запросов перед навигацией. Отменяем...`);
      activeFetchControllers.forEach(controller => controller.abort());
      activeFetchControllers.clear();
    }
  });


  // 3. Периодическая проверка "здоровья"
  const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 секунд
  let lastActivityTime = Date.now();

  router.afterEach(() => {
    lastActivityTime = Date.now();
  });
  
  const healthCheckIntervalId = setInterval(() => {
    const now = Date.now();
    // Проверяем, не зависла ли навигация (если isCurrentlyNavigating true дольше чем таймаут)
    if (isCurrentlyNavigating && (now - lastActivityTime) > NAVIGATION_TIMEOUT_MS + 5000) { // +5 сек буфер
        console.warn('Обнаружена потенциально зависшая навигация во время health check.');
        if (navigationTimeoutId) clearTimeout(navigationTimeoutId); // Очищаем старый таймер
        // Инициируем процесс обработки зависшей навигации, как в router.beforeEach
         navigationFailures++;
         isCurrentlyNavigating = false; 
         if (navigationFailures >= MAX_NAVIGATION_FAILURES) {
            forceAppReload(`зависшая навигация обнаружена health check (${navigationFailures})`);
         } else {
            console.warn(`Попытка восстановления после зависшей навигации (health check)`);
            // Можно попробовать "мягкий" ресет или просто переход на главную
            router.push('/'); 
         }
    }

    // Если приложение неактивно слишком долго (например, 5 минут)
    if (!isCurrentlyNavigating && (now - lastActivityTime > 5 * 60 * 1000)) {
      console.log('Приложение неактивно, очищаем Pinia stores для профилактики...');
      if (nuxtApp.$pinia) {
        for (const storeName in nuxtApp.$pinia.state.value) {
          const store = nuxtApp.$pinia.state.value[storeName];
          if (store && typeof store.$reset === 'function') {
            try {
              store.$reset();
            } catch (e) {
              console.warn(`Не удалось сбросить store ${storeName}:`, e);
            }
          }
        }
      }
      lastActivityTime = now; // Обновляем время, чтобы не чистить постоянно
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  // Очистка при закрытии вкладки
  window.addEventListener('beforeunload', () => {
    if (navigationTimeoutId) clearTimeout(navigationTimeoutId);
    clearInterval(healthCheckIntervalId);
    activeFetchControllers.forEach(controller => controller.abort());
  });

  console.log('🛡️ Плагин стабильности приложения запущен.');
}); 