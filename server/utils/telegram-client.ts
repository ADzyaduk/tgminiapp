import TelegramBot from 'node-telegram-bot-api'

const TELEGRAM_MESSAGE_LIMIT = 4096

// Singleton instance бота
let botInstance: TelegramBot | null = null

/**
 * Получает или создает экземпляр Telegram бота
 */
function getBotInstance (): TelegramBot | null {
  if (botInstance) {
    return botInstance
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.NUXT_TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured')
    return null
  }

  try {
    // Создаем бота только для отправки сообщений (без polling/webhook)
    botInstance = new TelegramBot(token, { polling: false })
    return botInstance
  } catch (error) {
    console.error('❌ Failed to create Telegram bot instance:', error)
    return null
  }
}

/**
 * Обрезает сообщение до лимита Telegram (4096 символов)
 */
function truncateMessage (text: string): string {
  if (!text) return text
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return text
  return `${text.slice(0, TELEGRAM_MESSAGE_LIMIT - 3)}...`
}

/**
 * Вызывает метод Telegram Bot API напрямую
 * Используется для методов, которые не имеют специализированных функций
 */
export async function callTelegramApi<T = any> (method: string, payload: Record<string, any>): Promise<T | null> {
  const bot = getBotInstance()
  if (!bot) return null

  try {
    // Используем внутренний метод библиотеки для вызова API
    // Это безопасно, так как библиотека предоставляет этот метод для расширенного использования
    const result = await (bot as any).request(method, payload)
    return result ?? null
  } catch (error: any) {
    console.error(`❌ Telegram API error (${method}):`, error.message || 'unknown error')
    return null
  }
}

type SendMessageOptions = {
  chatId: number | string
  text: string
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  disableWebPagePreview?: boolean
  replyMarkup?: any
}

/**
 * Отправляет сообщение через Telegram Bot API
 */
export async function sendMessage (options: SendMessageOptions) {
  const { chatId, text, parseMode = 'HTML', disableWebPagePreview = false, replyMarkup } = options

  const bot = getBotInstance()
  if (!bot) {
    return null
  }

  try {
    const result = await bot.sendMessage(chatId, truncateMessage(text), {
      parse_mode: parseMode,
      disable_web_page_preview: disableWebPagePreview,
      reply_markup: replyMarkup
    })

    return result
  } catch (error: any) {
    console.error('❌ Failed to send Telegram message:', error.message || error)
    return null
  }
}

/**
 * Отправляет фото с подписью
 */
export async function sendPhoto (chatId: number | string, photo: string | Buffer, caption?: string, options?: {
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  replyMarkup?: any
}) {
  const bot = getBotInstance()
  if (!bot) {
    return null
  }

  try {
    const result = await bot.sendPhoto(chatId, photo, {
      caption: caption ? truncateMessage(caption) : undefined,
      parse_mode: options?.parseMode,
      reply_markup: options?.replyMarkup
    })

    return result
  } catch (error: any) {
    console.error('❌ Failed to send Telegram photo:', error.message || error)
    return null
  }
}

/**
 * Редактирует сообщение
 */
export async function editMessageText (chatId: number | string, messageId: number, text: string, options?: {
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  replyMarkup?: any
}) {
  const bot = getBotInstance()
  if (!bot) {
    return null
  }

  try {
    const result = await bot.editMessageText(truncateMessage(text), {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: options?.parseMode,
      reply_markup: options?.replyMarkup
    })

    return result
  } catch (error: any) {
    console.error('❌ Failed to edit Telegram message:', error.message || error)
    return null
  }
}

/**
 * Удаляет сообщение
 */
export async function deleteMessage (chatId: number | string, messageId: number) {
  const bot = getBotInstance()
  if (!bot) {
    return null
  }

  try {
    const result = await bot.deleteMessage(chatId, messageId)
    return result
  } catch (error: any) {
    console.error('❌ Failed to delete Telegram message:', error.message || error)
    return null
  }
}

/**
 * Создает inline keyboard с кнопками для управления бронированием
 */
export function createBookingInlineKeyboard (bookingId: string, bookingType: 'regular' | 'group_trip' = 'regular') {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Подтвердить',
          callback_data: `booking_confirm_${bookingType}_${bookingId}`
        },
        {
          text: '❌ Отменить',
          callback_data: `booking_cancel_${bookingType}_${bookingId}`
        }
      ]
    ]
  }
}

/**
 * Отвечает на callback query (нажатие на inline кнопку)
 */
export async function answerCallbackQuery (callbackQueryId: string, text?: string, showAlert: boolean = false) {
  const bot = getBotInstance()
  if (!bot) {
    return null
  }

  try {
    const result = await bot.answerCallbackQuery(callbackQueryId, {
      text,
      show_alert: showAlert
    })
    return result
  } catch (error: any) {
    console.error('❌ Failed to answer callback query:', error.message || error)
    return null
  }
}


