import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import {
  sendClientStatusNotification,
  sendClientBookingConfirmation,
  sendBookingReminder,
  formatBookingNotificationEnhanced
} from '~/server/utils/telegram-notifications'

/**
 * API endpoint для тестирования различных типов уведомлений
 * Полезно для отладки и проверки работы системы уведомлений
 */
export default defineEventHandler(async (event) => {
  try {
    const {
      type,
      bookingId,
      status,
      managerName = 'Тестовый менеджер',
      hours = 24
    } = await readBody(event)

    if (!type || !bookingId) {
      return {
        status: 400,
        body: { error: 'Required fields: type, bookingId' }
      }
    }

    const supabase = await serverSupabaseClient(event)

    // Получаем бронирование
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(name)')
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      return {
        status: 404,
        body: { error: 'Booking not found' }
      }
    }

    let result = false
    let message = ''

    switch (type) {
      case 'booking_confirmation':
        result = await sendClientBookingConfirmation(booking)
        message = 'Booking confirmation notification'
        break

      case 'status_change':
        if (!status) {
          return {
            status: 400,
            body: { error: 'Status is required for status_change type' }
          }
        }
        result = await sendClientStatusNotification(booking, status, managerName)
        message = `Status change notification (${status})`
        break

      case 'reminder':
        result = await sendBookingReminder(booking, hours)
        message = `Booking reminder (${hours} hours)`
        break

      case 'manager_notification':
        const notificationMessage = formatBookingNotificationEnhanced(booking)
        console.log('📨 Manager notification preview:', notificationMessage)
        result = true
        message = 'Manager notification (preview in console)'
        break

      default:
        return {
          status: 400,
          body: { error: 'Invalid notification type. Available: booking_confirmation, status_change, reminder, manager_notification' }
        }
    }

    return {
      status: 200,
      body: {
        success: result,
        message,
        bookingId,
        type,
        clientHasTelegram: !!(booking as any).profile?.telegram_id,
        clientTelegramId: (booking as any).profile?.telegram_id || null
      }
    }
  } catch (error) {
    console.error('Error in test notifications:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
})
