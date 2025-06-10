import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!token) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN не настроен'
      }
    }

    console.log('🔍 Checking webhook info...')

    // Получаем информацию о webhook
    const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const webhookInfo = await webhookInfoResponse.json()

    // Получаем информацию о боте
    const botInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const botInfo = await botInfoResponse.json()

    console.log('📋 Webhook info:', JSON.stringify(webhookInfo, null, 2))
    console.log('🤖 Bot info:', JSON.stringify(botInfo, null, 2))

    return {
      success: true,
      webhook: webhookInfo,
      bot: botInfo,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      }
    }

  } catch (error) {
    console.error('❌ Webhook info error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
