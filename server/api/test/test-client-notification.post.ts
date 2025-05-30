import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    console.log('🧪 Testing client status notifications...')

    // Получаем параметры из запроса
    const { status = 'confirmed', telegram_id = '1231157381' } = await readBody(event)

    // Тестовые данные бронирования
    const testBooking = {
      id: 'test-123',
      boat: { name: 'Kiss' },
      start_time: new Date().toISOString(),
      profile: {
        telegram_id: telegram_id
      }
    }

    // Сообщения для разных статусов (как в реальном коде)
    const statusMessages: Record<string, string> = {
      confirmed: `✅ Ваше бронирование лодки "${testBooking.boat.name}" на ${new Date(testBooking.start_time).toLocaleDateString('ru-RU')} подтверждено!`,
      cancelled: `❌ Ваше бронирование лодки "${testBooking.boat.name}" на ${new Date(testBooking.start_time).toLocaleDateString('ru-RU')} было отменено.`,
      pending: `⏳ Ваше бронирование лодки "${testBooking.boat.name}" ожидает подтверждения.`
    }

    const message = statusMessages[status] || 'Статус вашего бронирования изменен'

    console.log('📱 Sending status notification to client:', {
      status,
      telegram_id,
      message
    })

    // Отправляем тестовое уведомление
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return {
        success: false,
        error: 'Telegram token not configured'
      }
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegram_id,
        text: message,
        parse_mode: 'HTML'
      })
    })

    const result = await response.json()

    return {
      success: response.ok,
      status_tested: status,
      telegram_id_tested: telegram_id,
      message_sent: message,
      telegram_response: result
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    return {
      success: false,
      error: 'Test failed',
      details: (error as Error).message
    }
  }
})
