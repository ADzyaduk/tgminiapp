import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const webhookUrl = body.webhook_url

    if (!webhookUrl) {
      return { error: 'webhook_url is required' }
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return { error: 'Telegram bot token not configured' }
    }

    const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook`

    const response = await fetch(setWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    })

    const result = await response.json()

    if (result.ok) {
      return {
        success: true,
        message: 'Webhook установлен успешно',
        webhook_url: webhookUrl
      }
    } else {
      return {
        error: 'Ошибка установки webhook',
        details: result
      }
    }

  } catch (error) {
    console.error('Error setting webhook:', error)
    return { error: 'Internal server error', details: error }
  }
})
