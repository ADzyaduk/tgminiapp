const TELEGRAM_API_URL = 'https://api.telegram.org/bot'
const TELEGRAM_MESSAGE_LIMIT = 4096

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
  disableWebPagePreview?: boolean
}

export async function sendMessage (options: SendMessageOptions) {
  const { chatId, text, parseMode = 'HTML', disableWebPagePreview = false } = options

  return await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: truncateMessage(text),
    parse_mode: parseMode,
    disable_web_page_preview: disableWebPagePreview
  })
}


