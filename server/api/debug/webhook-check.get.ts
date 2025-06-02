import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return { error: 'Telegram bot token not configured' }
    }

    // Получаем информацию о webhook
    const webhookInfoUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`
    const webhookResponse = await fetch(webhookInfoUrl)
    const webhookInfo = await webhookResponse.json()

    // Получаем последние обновления для проверки
    const getUpdatesUrl = `https://api.telegram.org/bot${token}/getUpdates?limit=5`
    const updatesResponse = await fetch(getUpdatesUrl)
    const updatesInfo = await updatesResponse.json()

    return {
      webhook: webhookInfo.result,
      recent_updates: updatesInfo.result,
      environment: {
        has_bot_token: !!process.env.TELEGRAM_BOT_TOKEN,
        admin_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || 'not set',
        current_url: event.node.req.headers.host
      }
    }

  } catch (error) {
    console.error('Error checking webhook:', error)
    return { error: 'Internal server error', details: error }
  }
})
