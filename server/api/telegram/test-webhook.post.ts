import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    console.log('🔔 Test webhook received request:')
    console.log('📋 Body:', JSON.stringify(body, null, 2))

    // Имитируем callback query для тестирования
    const testCallbackQuery = {
      update_id: Date.now(),
      callback_query: {
        id: 'test_' + Date.now(),
        data: 'regular:confirm:test-booking-id',
        message: {
          chat: { id: body.chat_id || 1231157381 },
          message_id: body.message_id || 1
        },
        from: {
          id: body.user_id || 1231157381,
          is_bot: false,
          first_name: 'Test Manager'
        }
      }
    }

    console.log('🧪 Simulating callback query:', JSON.stringify(testCallbackQuery, null, 2))

    // Отправляем тестовый callback на наш webhook
    const webhookUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/api/telegram/webhook'
      : 'https://yourdomain.com/api/telegram/webhook'

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCallbackQuery)
    })

    const result = await response.text()

    return {
      success: true,
      message: 'Test webhook executed',
      response: result,
      status: response.status
    }

  } catch (error) {
    console.error('❌ Test webhook error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})
