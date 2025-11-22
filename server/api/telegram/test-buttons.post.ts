import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/supabase'

/**
 * Тестовый endpoint для проверки работы кнопок
 * Позволяет отправить тестовое уведомление с кнопками и проверить что они работают
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { chat_id, test_type = 'callback' } = body

    if (!chat_id) {
      return { 
        success: false, 
        error: 'chat_id обязателен' 
      }
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return { 
        success: false, 
        error: 'TELEGRAM_BOT_TOKEN не настроен' 
      }
    }

    // Генерируем тестовый UUID
    const testBookingId = '00000000-0000-0000-0000-000000000001'
    const bookingType = 'regular'

    let message = ''
    let replyMarkup: any = null

    if (test_type === 'callback') {
      // Тест с callback кнопками
      message = `🧪 <b>ТЕСТ КНОПОК (callback)</b>

Это тестовое сообщение для проверки работы инлайн кнопок.

🆔 <b>Booking ID:</b> <code>${testBookingId}</code>
📋 <b>Тип:</b> Обычное бронирование

Нажмите на кнопки ниже. Если они работают:
1. "Часики" исчезнут сразу
2. Сообщение обновится через 1-2 секунды
3. Кнопки исчезнут, появится статус`

      const confirmData = `${bookingType}:confirm:${testBookingId}`
      const cancelData = `${bookingType}:cancel:${testBookingId}`

      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '✅ Подтвердить (тест)',
              callback_data: confirmData
            },
            {
              text: '❌ Отменить (тест)',
              callback_data: cancelData
            }
          ]
        ]
      }
    } else {
      // Тест с URL кнопками
      const webAppUrl = process.env.TELEGRAM_WEBAPP_URL || ''
      message = `🧪 <b>ТЕСТ КНОПОК (URL)</b>

Это тестовое сообщение с кнопками-ссылками.

Нажмите на кнопку ниже - должно открыться приложение.`

      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '🚀 Открыть приложение (тест)',
              url: webAppUrl
            }
          ]
        ]
      }
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    const response = await fetch(apiUrl, {
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
        message: 'Тестовое сообщение отправлено',
        test_type,
        telegram_response: result
      }
    } else {
      return {
        success: false,
        error: 'Ошибка отправки сообщения',
        details: result
      }
    }

  } catch (error: any) {
    console.error('Error in test buttons:', error)
    return { 
      success: false, 
      error: 'Внутренняя ошибка', 
      details: error.message 
    }
  }
})
