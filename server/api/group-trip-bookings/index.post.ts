import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // Получаем данные бронирования из запроса
    const body = await readBody(event)

    // Проверяем авторизацию пользователя (но не блокируем если не авторизован)
    let user = null
    try {
      user = await serverSupabaseUser(event)
    } catch (error) {
      // Разрешаем анонимные бронирования
    }

    // Подключаемся к Supabase
    const supabase = await serverSupabaseClient(event)

    // Проверяем доступность мест в поездке
    const { data: trip, error: tripError } = await (supabase as any)
      .from('group_trips')
      .select('*, boat:boats(*)')
      .eq('id', body.group_trip_id)
      .single()

    if (tripError || !trip) {
      setResponseStatus(event, 404)
      return { error: 'Group trip not found' }
    }

    const totalTickets = (body.adult_count || 0) + (body.child_count || 0)
    if (trip.available_seats < totalTickets) {
      setResponseStatus(event, 400)
      return { error: 'Not enough available seats' }
    }

    // Создаем бронирование
    const bookingData = {
      ...body,
      user_id: user ? user.id : null, // Добавляем ID пользователя только если пользователь авторизован
      status: 'confirmed' // Групповые бронирования сразу подтверждаются
    }

    const { data: booking, error: bookingError } = await (supabase as any)
      .from('group_trip_bookings')
      .insert(bookingData)
      .select('*')
      .single()

    if (bookingError) {
      console.error('Error creating group trip booking:', bookingError)
      setResponseStatus(event, 500)
      return { error: 'Failed to create booking', details: bookingError }
    }

    // Обновляем доступные места в поездке
    const newAvailableSeats = trip.available_seats - totalTickets
    const newStatus = newAvailableSeats <= 0 ? 'full' : trip.status

    await (supabase as any)
      .from('group_trips')
      .update({
        available_seats: newAvailableSeats,
        status: newStatus
      })
      .eq('id', body.group_trip_id)

    // Отправляем уведомления
    try {
      // Получаем полные данные о клиенте (если авторизован)
      let clientProfile = null
      if (user) {
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        clientProfile = profile
      }

      // Создаем объект бронирования с полными данными для уведомлений
      const bookingWithDetails = {
        ...booking,
        profile: clientProfile,
        group_trip: trip,
        boat: trip.boat
      }

      // Отправляем уведомление клиенту (если есть telegram_id)
      if (clientProfile?.telegram_id) {
        const { sendGroupTripBookingConfirmation } = await import('~/server/utils/telegram-notifications')
        await sendGroupTripBookingConfirmation(bookingWithDetails)
      }

      // Отправляем уведомление администраторам и менеджерам
      const { formatGroupTripBookingNotification, sendAdminNotification } = await import('~/server/utils/telegram-notifications')
      const notificationMessage = formatGroupTripBookingNotification(bookingWithDetails)

      await sendAdminNotification(notificationMessage, {
        parseMode: 'HTML',
        boatId: trip.boat_id,
        bookingId: booking.id,
        event
      })

    } catch (notifyError) {
      console.error('Failed to send group trip booking notifications:', notifyError)
      // Не падаем, если уведомления не отправились
    }

    // Возвращаем успешный результат
    setResponseStatus(event, 201)
    return {
      success: true,
      data: booking,
      message: 'Group trip booking created successfully'
    }

  } catch (error) {
    console.error('Error in group trip booking creation:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error', details: error }
  }
})
