export default defineNuxtPlugin(() => {
  // Функция для ожидания загрузки Telegram WebApp
  const waitForTelegramWebApp = (): Promise<void> => {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        console.log('✅ Telegram WebApp already loaded')
        resolve()
        return
      }

      // Ждем максимум 10 секунд
      let attempts = 0
      const maxAttempts = 100

      const checkTelegram = setInterval(() => {
        attempts++

        if (window.Telegram?.WebApp) {
          console.log('✅ Telegram WebApp loaded after', attempts * 100, 'ms')
          clearInterval(checkTelegram)
          resolve()
        } else if (attempts >= maxAttempts) {
          console.warn('⚠️ Telegram WebApp not loaded after 10 seconds')
          clearInterval(checkTelegram)
          resolve()
        }
      }, 100)
    })
  }

  // Инициализация Telegram WebApp
  const initTelegramWebApp = () => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp as any

      // Расширяем приложение на весь экран
      if (tg.expand) tg.expand()

      // Включаем режим затемнения фона
      if (tg.enableClosingConfirmation) tg.enableClosingConfirmation()

      // Настраиваем цвета если нужно
      if (tg.themeParams) {
        console.log('🎨 Telegram Theme Params:', tg.themeParams)
      }

      // Логируем initData для отладки
      if (tg.initData) {
        console.log('📱 Telegram initData available, length:', tg.initData.length)
      } else {
        console.warn('⚠️ Telegram initData is empty - this may happen in development')
      }

      // Логируем информацию о пользователе
      if (tg.initDataUnsafe?.user) {
        console.log('👤 Telegram User:', tg.initDataUnsafe.user)
      }

      // Уведомляем Telegram что приложение готово
      if (tg.ready) tg.ready()

      console.log('🚀 Telegram WebApp initialized')
    } else {
      console.warn('❌ Telegram WebApp not available')
    }
  }

  // Запускаем инициализацию
  waitForTelegramWebApp().then(() => {
    initTelegramWebApp()
  })

  // Добавляем глобальные типы для лучшей поддержки TypeScript
  if (process.client) {
    // Делаем Telegram WebApp доступным глобально для отладки
    (window as any).__TELEGRAM_DEBUG__ = {
      getWebApp: () => window.Telegram?.WebApp,
      getInitData: () => window.Telegram?.WebApp?.initData,
      getUser: () => window.Telegram?.WebApp?.initDataUnsafe?.user,
      getTheme: () => (window.Telegram?.WebApp as any)?.themeParams
    }
  }
})
