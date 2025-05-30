import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { formatBookingNotification, sendAdminNotification } from '~/server/utils/telegram-notifications'

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

    // Отправляем уведомление администраторам
    if (booking) {
      try {
        // Формируем текст уведомления
        const notificationMessage = formatBookingNotification(booking)

        // Отправляем уведомление с кнопками для подтверждения/отмены
        await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: booking.boat_id as string,
          bookingId: booking.id as string,
          event
        })
      } catch (notifyError) {
        // Логируем ошибку, но не влияем на основной ответ API
        console.error('Failed to send notification:', notifyError)
      }
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
