const TELEGRAM_API_URL = 'https://api.telegram.org/bot'
const TELEGRAM_MESSAGE_LIMIT = 4096
const CALLBACK_DATA_LIMIT = 64

type InlineKeyboardButton = {
  text: string
  url?: string
  callback_data?: string
}

export type InlineKeyboardMarkup = {
  inline_keyboard: InlineKeyboardButton[][]
}

type TelegramApiResponse<T> = {
  ok: boolean
  result?: T
  description?: string
}

function getBotToken () {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured')
    return null
  }
  return token
}

function truncateMessage (text: string) {
  if (!text) return text
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return text
  return `${text.slice(0, TELEGRAM_MESSAGE_LIMIT - 3)}...`
}

function truncateToBytes (value: string, maxBytes: number) {
  const encoder = new TextEncoder()
  let current = value
  while (encoder.encode(current).length > maxBytes && current.length > 0) {
    current = current.slice(0, -1)
  }
  return current
}

export function buildCallbackData (bookingType: string, action: string, bookingId: string) {
  const prefix = `${bookingType}:${action}:`
  const encoder = new TextEncoder()
  const prefixLength = encoder.encode(prefix).length
  const maxIdBytes = Math.max(CALLBACK_DATA_LIMIT - prefixLength, 0)
  const safeId = truncateToBytes(bookingId, maxIdBytes)
  const payload = `${prefix}${safeId}`

  if (encoder.encode(payload).length > CALLBACK_DATA_LIMIT) {
    console.warn(`⚠️ Callback data still exceeds ${CALLBACK_DATA_LIMIT} bytes, truncating aggressively`)
    return truncateToBytes(payload, CALLBACK_DATA_LIMIT)
  }

  return payload
}

export async function callTelegramApi<T = any> (method: string, payload: Record<string, any>): Promise<T | null> {
  const token = getBotToken()
  if (!token) return null

  const url = `${TELEGRAM_API_URL}${token}/${method}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data: TelegramApiResponse<T> = await response.json()

    if (!data.ok) {
      console.error(`❌ Telegram API error (${method}): ${data.description || 'unknown error'}`)
      return null
    }

    return data.result ?? null
  } catch (error) {
    console.error(`❌ Telegram API network error (${method}):`, error)
    return null
  }
}

type SendMessageOptions = {
  chatId: number | string
  text: string
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  replyMarkup?: InlineKeyboardMarkup
  disableWebPagePreview?: boolean
}

export async function sendMessage (options: SendMessageOptions) {
  const { chatId, text, parseMode = 'HTML', replyMarkup, disableWebPagePreview = false } = options

  return await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: truncateMessage(text),
    parse_mode: parseMode,
    disable_web_page_preview: disableWebPagePreview,
    reply_markup: replyMarkup
  })
}

type SendInlineKeyboardOptions = {
  chatId: number | string
  text: string
  keyboard: InlineKeyboardMarkup
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
}

export async function sendInlineKeyboard (options: SendInlineKeyboardOptions) {
  const { chatId, text, keyboard, parseMode } = options
  return await sendMessage({
    chatId,
    text,
    parseMode,
    replyMarkup: keyboard
  })
}

type AnswerCallbackOptions = {
  callbackQueryId: string
  text?: string
  showAlert?: boolean
  url?: string
  cacheTime?: number
}

export async function answerCallbackQuery (options: AnswerCallbackOptions) {
  const { callbackQueryId, text, showAlert = false, url, cacheTime } = options
  return await callTelegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
    url,
    cache_time: cacheTime
  })
}

type EditMessageOptions = {
  chatId: number | string
  messageId: number
  text: string
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown'
  replyMarkup?: InlineKeyboardMarkup
}

export async function editMessageText (options: EditMessageOptions) {
  const { chatId, messageId, text, parseMode = 'HTML', replyMarkup } = options

  return await callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: truncateMessage(text),
    parse_mode: parseMode,
    reply_markup: replyMarkup
  })
}

