/**
 * Composable для синхронизации Telegram данных
 */
export const useTelegramSync = () => {

  const syncTelegramUser = async () => {
    // Проверяем, что мы в Telegram Mini App
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp

      // Получаем данные пользователя из Telegram
      const telegramUser = tg.initDataUnsafe?.user

      if (telegramUser) {
        try {
          // Отправляем данные на сервер для синхронизации
          const { data } = await $fetch('/api/telegram/sync-user', {
            method: 'POST',
            body: {
              telegram_user: telegramUser
            }
          })

          console.log('Telegram user synced:', data)
          return data
        } catch (error) {
          console.error('Failed to sync telegram user:', error)
        }
      }
    }
  }

  // Автоматически синхронизируем при инициализации
  const initTelegramSync = () => {
    if (process.client) {
      // Ждем загрузки Telegram WebApp
      if (window.Telegram?.WebApp) {
        syncTelegramUser()
      } else {
        // Ждем загрузки скрипта Telegram
        const checkTelegram = setInterval(() => {
          if (window.Telegram?.WebApp) {
            clearInterval(checkTelegram)
            syncTelegramUser()
          }
        }, 100)

        // Прекращаем проверку через 5 секунд
        setTimeout(() => clearInterval(checkTelegram), 5000)
      }
    }
  }

  return {
    syncTelegramUser,
    initTelegramSync
  }
}
