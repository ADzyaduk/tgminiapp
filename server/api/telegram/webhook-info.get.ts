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

    // Получаем информацию о боте
    const botInfoUrl = `https://api.telegram.org/bot${token}/getMe`
    const botResponse = await fetch(botInfoUrl)
    const botInfo = await botResponse.json()

    return {
      bot: botInfo.result,
      webhook: webhookInfo.result
    }

  } catch (error) {
    console.error('Error getting webhook info:', error)
    return { error: 'Internal server error', details: error }
  }
})
