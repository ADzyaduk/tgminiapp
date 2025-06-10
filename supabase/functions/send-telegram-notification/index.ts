// Supabase Edge Function for sending notifications via Telegram Bot API

// Define the request payload type according to official Telegram Bot API documentation
interface TelegramNotificationPayload {
  telegram_id: string | number  // Can be either string or number (user ID)
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
}

// Telegram SendMessage API parameters according to official documentation
interface TelegramSendMessageParams {
  chat_id: string | number
  text: string
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  entities?: any[]
  disable_web_page_preview?: boolean
  disable_notification?: boolean
  protect_content?: boolean
  reply_to_message_id?: number
  allow_sending_without_reply?: boolean
  reply_markup?: any
}

Deno.serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        status: 204,
      })
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 405,
      })
    }

    // Parse the request body
    const payload: TelegramNotificationPayload = await req.json()
    const { telegram_id, message, type, parse_mode = 'HTML' } = payload

    if (!telegram_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields: telegram_id and message' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validate parse_mode
    if (parse_mode && !['HTML', 'Markdown', 'MarkdownV2'].includes(parse_mode)) {
      return new Response(JSON.stringify({ error: 'Invalid parse_mode. Must be HTML, Markdown, or MarkdownV2' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Get the Telegram bot token from environment variables
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')

    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN environment variable not set')
      return new Response(JSON.stringify({ error: 'Bot token not configured' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Add emoji based on notification type
    const emoji = getEmojiForType(type)
    const formattedMessage = `${emoji} ${message}`

    // Prepare message parameters according to Telegram Bot API documentation
    const messageParams: TelegramSendMessageParams = {
      chat_id: telegram_id,
      text: formattedMessage,
      parse_mode: parse_mode
    }

    // Send the message via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageParams),
    })

    // Get the Telegram API response
    const telegramResult = await telegramResponse.json()

    // Log errors for debugging
    if (!telegramResult.ok) {
      console.error('Telegram API error:', {
        error_code: telegramResult.error_code,
        description: telegramResult.description,
        parameters: telegramResult.parameters,
        payload: messageParams
      })
    }

    // Return the result
    return new Response(JSON.stringify({
      success: telegramResult.ok,
      data: telegramResult,
      error_code: telegramResult.error_code || null,
      description: telegramResult.description || null
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: telegramResult.ok ? 200 : 400, // Use 400 for API errors instead of 500
    })
  } catch (error) {
    console.error('Error sending Telegram notification:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      error_code: null,
      description: 'Internal server error'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Helper function to get emoji based on notification type
function getEmojiForType(type: string): string {
  switch (type) {
    case 'success':
      return '✅'
    case 'warning':
      return '⚠️'
    case 'error':
      return '❌'
    case 'info':
    default:
      return 'ℹ️'
  }
}
