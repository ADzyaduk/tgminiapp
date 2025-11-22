/**
 * Конфигурация Telegram Bot
 */

export interface TelegramConfig {
  botToken: string
  webAppUrl: string
  adminChatId?: string
}

export function getTelegramConfig(): TelegramConfig {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is required')
  }

  if (!webAppUrl) {
    throw new Error('TELEGRAM_WEBAPP_URL environment variable is required')
  }

  return {
    botToken,
    webAppUrl,
    adminChatId
  }
}

/**
 * Команды бота для пользователей
 */
export const USER_COMMANDS = [
  {
    command: 'start',
    description: 'Главное меню и открытие приложения'
  },
  {
    command: 'help',
    description: 'Справка по командам'
  },
  {
    command: 'mybookings',
    description: 'Мои бронирования'
  },
  {
    command: 'status',
    description: 'Статус последнего бронирования'
  },
  {
    command: 'boats',
    description: 'Список доступных лодок'
  }
]

/**
 * Команды бота для администраторов
 */
export const ADMIN_COMMANDS = [
  {
    command: 'admin',
    description: 'Меню администратора'
  },
  {
    command: 'adminstats',
    description: 'Статистика бронирований'
  },
  {
    command: 'admintoday',
    description: 'Бронирования на сегодня'
  },
  {
    command: 'adminremind',
    description: 'Отправить напоминания'
  },
  {
    command: 'adminlogs',
    description: 'Просмотр логов бота'
  }
]

/**
 * Установка команд бота через API
 */
export async function setupBotCommands(config: TelegramConfig): Promise<boolean> {
  try {
    const apiUrl = `https://api.telegram.org/bot${config.botToken}/setMyCommands`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: USER_COMMANDS
      })
    })

    return response.ok
  } catch (error) {
    console.error('Error setting up bot commands:', error)
    return false
  }
}

/**
 * Установка webhook для бота
 */
export async function setupWebhook(config: TelegramConfig, webhookUrl: string): Promise<boolean> {
  try {
    const apiUrl = `https://api.telegram.org/bot${config.botToken}/setWebhook`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    })

    const result = await response.json()
    console.log('Webhook setup result:', result)

    return response.ok
  } catch (error) {
    console.error('Error setting up webhook:', error)
    return false
  }
}
