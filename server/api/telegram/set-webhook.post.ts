import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!token) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN не настроен'
      }
    }

    // URL для webhook - должен быть HTTPS в продакшене
    const webhookUrl = body.webhook_url ||
      (process.env.NODE_ENV === 'development'
        ? 'https://your-ngrok-url.ngrok.io/api/telegram/webhook'
        : 'https://yourdomain.com/api/telegram/webhook')

    console.log(`🔗 Setting webhook URL: ${webhookUrl}`)

    // Устанавливаем webhook
    const setWebhookResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['callback_query', 'message'] // Только нужные типы обновлений
      })
    })

    const setWebhookResult = await setWebhookResponse.json()

    // Проверяем текущую информацию о webhook
    const getWebhookResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const getWebhookResult = await getWebhookResponse.json()

    console.log('📋 Webhook info:', JSON.stringify(getWebhookResult, null, 2))

    return {
      success: setWebhookResult.ok,
      setWebhook: setWebhookResult,
      webhookInfo: getWebhookResult,
      configuredUrl: webhookUrl
    }

  } catch (error) {
    console.error('❌ Set webhook error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
