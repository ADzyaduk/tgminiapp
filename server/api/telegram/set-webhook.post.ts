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

    // URL для webhook - должен быть HTTPS
    const webhookUrl = body.webhook_url || ''

    if (!webhookUrl) {
      return {
        success: false,
        error: 'webhook_url is required. Пример: https://yourdomain.com/api/telegram/webhook'
      }
    }

    console.log(`🔗 Setting webhook URL: ${webhookUrl}`)

    // Сначала удаляем существующий webhook
    console.log('🗑️ Removing existing webhook...')
    await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true })
    })

    // Устанавливаем новый webhook
    console.log('🔄 Setting new webhook...')
    const setWebhookResponse = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['callback_query', 'message'], // Только нужные типы обновлений
        drop_pending_updates: true // Удаляем старые pending updates
      })
    })

    const setWebhookResult = await setWebhookResponse.json()

    // Проверяем текущую информацию о webhook
    const getWebhookResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const getWebhookResult = await getWebhookResponse.json()

    console.log('📋 Set webhook result:', JSON.stringify(setWebhookResult, null, 2))
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
