// Supabase Edge Function for sending notifications via Telegram Bot API

// Define the request payload type
interface TelegramNotificationPayload {
  telegram_id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
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
    const { telegram_id, message, type } = payload

    if (!telegram_id || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
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

    // Send the message via Telegram Bot API
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: telegram_id,
        text: formattedMessage,
        parse_mode: 'HTML',
      }),
    })

    // Get the Telegram API response
    const telegramResult = await telegramResponse.json()

    // Return the result
    return new Response(JSON.stringify({
      success: telegramResult.ok,
      data: telegramResult
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: telegramResult.ok ? 200 : 500,
    })
  } catch (error) {
    console.error('Error sending Telegram notification:', error)
    return new Response(JSON.stringify({ error: error.message }), {
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