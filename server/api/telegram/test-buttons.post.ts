import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { chat_id, booking_id, booking_type = 'regular' } = body

    if (!chat_id || !booking_id) {
      return { error: 'chat_id and booking_id are required' }
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return { error: 'Telegram bot token not configured' }
    }

    // Создаем тестовое сообщение с кнопками
    const message = `🧪 <b>ТЕСТОВОЕ УВЕДОМЛЕНИЕ</b>

Это тестовое сообщение для проверки интерактивных кнопок.

🆔 <b>Booking ID:</b> ${booking_id}
📋 <b>Тип:</b> ${booking_type === 'regular' ? 'Обычное бронирование' : 'Групповая поездка'}

Нажмите на кнопки ниже для тестирования:`

    const replyMarkup = {
      inline_keyboard: [
        [
          {
            text: '✅ Подтвердить',
            callback_data: `confirm_${booking_type}_${booking_id}`
          },
          {
            text: '❌ Отменить',
            callback_data: `cancel_${booking_type}_${booking_id}`
          }
        ]
      ]
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: message,
        parse_mode: 'HTML',
        reply_markup: replyMarkup
      })
    })

    const result = await response.json()

    if (result.ok) {
      return {
        success: true,
        message: 'Тестовое уведомление отправлено',
        telegram_response: result
      }
    } else {
      return {
        error: 'Ошибка отправки сообщения',
        details: result
      }
    }

  } catch (error) {
    console.error('Error sending test notification:', error)
    return { error: 'Internal server error', details: error }
  }
})
