import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

// Типы для тестирования уведомлений согласно документации Telegram Bot API
interface TestNotificationRequest {
  type: 'booking_confirmation' | 'status_change' | 'reminder' | 'admin_notification'
  bookingId?: string
  userId?: string
  status?: 'confirmed' | 'cancelled' | 'pending'
  managerName?: string
  hours?: number
  message?: string
}

/**
 * API endpoint для тестирования различных типов уведомлений
 * Полезно для отладки и проверки работы системы уведомлений
 */
export default defineEventHandler(async (event) => {
  try {
    const body: TestNotificationRequest = await readBody(event)
    const { type, bookingId, status, managerName, hours, message } = body

    // Проверяем наличие токена
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN
    if (!telegramToken) {
      setResponseStatus(event, 500)
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN не настроен'
      }
    }

    // Импортируем функции уведомлений
    const {
      sendClientBookingConfirmation,
      sendClientStatusNotification,
      sendBookingReminder,
      sendAdminNotification
    } = await import('~/server/utils/telegram-notifications')

    const supabase = serverSupabaseServiceRole(event)

    switch (type) {
      case 'booking_confirmation':
        if (!bookingId) {
          setResponseStatus(event, 400)
          return { success: false, error: 'bookingId обязателен' }
        }

        const { data: booking } = await supabase
          .from('bookings')
          .select('*, profile:profiles(*), boat:boats(*)')
          .eq('id', bookingId)
          .single()

        if (!booking) {
          setResponseStatus(event, 404)
          return { success: false, error: 'Бронирование не найдено' }
        }

        const result = await sendClientBookingConfirmation(booking)
        return {
          success: result,
          message: result ? 'Уведомление о подтверждении отправлено' : 'Не удалось отправить уведомление'
        }

      case 'status_change':
        if (!bookingId || !status) {
          setResponseStatus(event, 400)
          return { success: false, error: 'bookingId и status обязательны' }
        }

        const { data: statusBooking } = await supabase
          .from('bookings')
          .select('*, profile:profiles(*), boat:boats(*)')
          .eq('id', bookingId)
          .single()

        if (!statusBooking) {
          setResponseStatus(event, 404)
          return { success: false, error: 'Бронирование не найдено' }
        }

        const statusResult = await sendClientStatusNotification(statusBooking, status, managerName)
        return {
          success: statusResult,
          message: statusResult ? 'Уведомление о статусе отправлено' : 'Не удалось отправить уведомление'
        }

      case 'reminder':
        if (!bookingId) {
          setResponseStatus(event, 400)
          return { success: false, error: 'bookingId обязателен' }
        }

        const { data: reminderBooking } = await supabase
          .from('bookings')
          .select('*, profile:profiles(*), boat:boats(*)')
          .eq('id', bookingId)
          .single()

        if (!reminderBooking) {
          setResponseStatus(event, 404)
          return { success: false, error: 'Бронирование не найдено' }
        }

        const reminderResult = await sendBookingReminder(reminderBooking, hours || 2)
        return {
          success: reminderResult,
          message: reminderResult ? 'Напоминание отправлено' : 'Не удалось отправить напоминание'
        }

      case 'admin_notification':
        const testMessage = message || `🔔 <b>ТЕСТОВОЕ УВЕДОМЛЕНИЕ</b>

Это тестовое сообщение для проверки системы уведомлений.

⏰ Время отправки: ${new Date().toLocaleString('ru-RU')}`

        const adminResult = await sendAdminNotification(testMessage, {
          parseMode: 'HTML',
          bookingId,
          event
        })

        return {
          success: adminResult,
          message: adminResult ? 'Уведомление администратору отправлено' : 'Не удалось отправить уведомление'
        }

      default:
        setResponseStatus(event, 400)
        return {
          success: false,
          error: 'Неизвестный тип тестирования'
        }
    }

  } catch (error: any) {
    console.error('❌ Test notification error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error.message || 'Внутренняя ошибка сервера'
    }
  }
})
