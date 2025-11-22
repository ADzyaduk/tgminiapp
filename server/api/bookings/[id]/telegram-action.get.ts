import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/supabase'
import { addLog } from '~/server/utils/telegram-logs'

/**
 * API endpoint для обработки изменения статуса бронирования через ссылку из Telegram
 * Используется когда кнопки не работают и вместо них используются ссылки в приложение
 * 
 * URL формат: /api/bookings/[id]/telegram-action?action=confirm&type=regular
 */
export default defineEventHandler(async (event: H3Event) => {
  try {
    // Получаем ID из URL пути
    const bookingId = event.context.params?.id
    const query = getQuery(event)
    const { action, type = 'regular' } = query

    if (!bookingId || !action) {
      setResponseStatus(event, 400)
      return { 
        success: false, 
        error: 'Не указан ID бронирования или действие' 
      }
    }

    if (action !== 'confirm' && action !== 'cancel') {
      setResponseStatus(event, 400)
      return { 
        success: false, 
        error: 'Неверное действие. Используйте confirm или cancel' 
      }
    }

    const supabase = serverSupabaseServiceRole<Database>(event)

    console.log(`🔄 Processing ${action} for ${type} booking ${bookingId} via app link`)

    // Обрабатываем в зависимости от типа бронирования
    if (type === 'regular') {
      const { data: booking, error: fetchError } = await supabase
        .from('bookings')
        .select('*, profile:profiles(*), boat:boats(*)')
        .eq('id', bookingId)
        .single()

      if (fetchError || !booking) {
        console.error(`🚨 Booking not found: ${bookingId}`, fetchError)
        setResponseStatus(event, 404)
        return { success: false, error: 'Бронирование не найдено' }
      }

      if (booking.status !== 'pending') {
        return { 
          success: false, 
          message: `Бронирование уже обработано. Текущий статус: ${booking.status}`,
          booking 
        }
      }

      const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
      
      const { data: updatedBooking, error: updateError } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .select('*, profile:profiles(*), boat:boats(*)')
        .single()

      if (updateError) {
        console.error(`🚨 DB update error:`, updateError)
        setResponseStatus(event, 500)
        return { success: false, error: 'Ошибка обновления статуса' }
      }

      // Уведомляем клиента
      const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications')
      await sendClientStatusNotification(updatedBooking as any, newStatus)

      addLog('success', `Booking ${bookingId} updated to ${newStatus} via app link`, { 
        bookingId, 
        action, 
        newStatus 
      })

      return { 
        success: true, 
        message: `Бронирование ${action === 'confirm' ? 'подтверждено' : 'отменено'}`,
        booking: updatedBooking 
      }

    } else if (type === 'group_trip') {
      const { data: booking, error: fetchError } = await supabase
        .from('group_trip_bookings')
        .select('*, profile:profiles(*), group_trip:group_trips(*, boat:boats(*))')
        .eq('id', bookingId)
        .single()

      if (fetchError || !booking) {
        console.error(`🚨 Group trip booking not found: ${bookingId}`, fetchError)
        setResponseStatus(event, 404)
        return { success: false, error: 'Бронирование не найдено' }
      }

      if (booking.status === 'cancelled') {
        return { 
          success: false, 
          message: `Бронирование уже отменено`,
          booking 
        }
      }

      const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
      
      const { data: updatedBooking, error: updateError } = await supabase
        .from('group_trip_bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .select('*, profile:profiles(*), group_trip:group_trips(*, boat:boats(*))')
        .single()

      if (updateError) {
        console.error(`🚨 DB update error:`, updateError)
        setResponseStatus(event, 500)
        return { success: false, error: 'Ошибка обновления статуса' }
      }

      // Уведомляем клиента
      const { sendGroupTripStatusNotification } = await import('~/server/utils/telegram-notifications')
      await sendGroupTripStatusNotification(updatedBooking as any, newStatus)

      addLog('success', `Group trip booking ${bookingId} updated to ${newStatus} via app link`, { 
        bookingId, 
        action, 
        newStatus 
      })

      return { 
        success: true, 
        message: `Бронирование ${action === 'confirm' ? 'подтверждено' : 'отменено'}`,
        booking: updatedBooking 
      }
    } else {
      setResponseStatus(event, 400)
      return { success: false, error: 'Неверный тип бронирования' }
    }

  } catch (error: any) {
    console.error('❌ Error processing booking action via app link:', error)
    addLog('error', 'Error processing booking action via app link', { error: error.message })
    setResponseStatus(event, 500)
    return { success: false, error: 'Внутренняя ошибка сервера' }
  }
})

