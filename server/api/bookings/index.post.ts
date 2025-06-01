import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import {
  formatBookingNotification,
  formatBookingNotificationEnhanced,
  sendAdminNotification,
  sendClientBookingConfirmation
} from '~/server/utils/telegram-notifications'

export default defineEventHandler(async (event) => {
  try {
    // Получаем данные бронирования из запроса
    const body = await readBody(event)

    // Проверяем авторизацию пользователя (но не блокируем если не авторизован)
    let user = null
    try {
      user = await serverSupabaseUser(event)
    } catch (error) {

    }

    // Подключаемся к Supabase
    const supabase = await serverSupabaseClient(event)

    // Создаем запись о бронировании
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        ...body,
        user_id: user ? user.id : null, // Добавляем ID пользователя только если пользователь авторизован
        status: 'pending' // Начальный статус - ожидает подтверждения
      })
      .select('*, profile:user_id(*), boat:boat_id(name)')
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      return {
        status: 500,
        body: { error: 'Failed to create booking' }
      }
    }

    // Отправляем уведомления
    if (booking) {
      try {
        console.log('📧 Starting notification process for booking:', (booking as any).id)

        // Формируем улучшенный текст уведомления для менеджеров
        const notificationMessage = formatBookingNotificationEnhanced(booking)
        console.log('📝 Enhanced notification message formatted')

        // Отправляем уведомление менеджерам с кнопками для подтверждения/отмены
        console.log('🚀 Calling sendAdminNotification with:', {
          boatId: (booking as any).boat_id,
          bookingId: (booking as any).id,
          hasEvent: !!event
        })

        const notificationResult = await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: (booking as any).boat_id as string,
          bookingId: (booking as any).id as string,
          event
        })

        console.log('✅ Manager notification result:', notificationResult)

        // Отправляем подтверждение клиенту, если у него есть Telegram ID
        if ((booking as any).profile?.telegram_id) {
          console.log('📱 Sending booking confirmation to client:', (booking as any).profile.telegram_id)

          const clientNotificationResult = await sendClientBookingConfirmation(booking)
          console.log('✅ Client confirmation result:', clientNotificationResult)
        } else {
          console.log('ℹ️ Client has no telegram_id, skipping client confirmation')
        }
      } catch (notifyError) {
        // Логируем ошибку, но не влияем на основной ответ API
        console.error('❌ Failed to send notifications:', notifyError)
      }
    } else {
      console.log('⚠️ No booking created, skipping notifications')
    }

    return {
      status: 201,
      body: booking
    }
  } catch (error) {
    console.error('Error in booking creation:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
})
