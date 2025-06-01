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
    try {
      console.log('📧 Starting notification process for booking:', (booking as any).id)

      // Отправляем улучшенное уведомление менеджерам
      const enhancedMessage = formatBookingNotificationEnhanced(booking)

      await sendAdminNotification(enhancedMessage, {
        parseMode: 'HTML',
        boatId: (booking as any).boat_id,
        bookingId: (booking as any).id,
        bookingType: 'regular',
        event
      })

      // Отправляем подтверждение клиенту (если есть telegram_id)
      if ((booking as any).profile?.telegram_id) {
        await sendClientBookingConfirmation(booking)
      }

    } catch (notifyError) {
      console.error('Failed to send notifications:', notifyError)
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
