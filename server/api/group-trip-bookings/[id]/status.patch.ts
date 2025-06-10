import { defineEventHandler, readBody, getRouterParam, setResponseStatus, getCookie } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  id: string
  telegram_id: string
  role: string
  type: string
  iat?: number
  exp?: number
}

export default defineEventHandler(async (event) => {
  try {
    // Получаем ID бронирования из параметров
    const bookingId = getRouterParam(event, 'id')

    if (!bookingId) {
      setResponseStatus(event, 400)
      return { error: 'Booking ID is required' }
    }

    // Получаем новый статус из запроса
    const { status } = await readBody(event)

    // Проверяем валидность статуса
    const validStatuses = ['confirmed', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      setResponseStatus(event, 400)
      return { error: 'Invalid status. Valid values: confirmed, completed, cancelled' }
    }

    // Проверяем авторизацию пользователя через JWT токены
    const accessToken = getCookie(event, 'tg-access-token')
    const refreshToken = getCookie(event, 'tg-refresh-token')

    if (!refreshToken) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized - no refresh token' }
    }

    const config = useRuntimeConfig()
    const jwtSecret = config.jwtSecret || 'your-jwt-secret-here'
    const jwtRefreshSecret = config.jwtRefreshSecret || 'your-refresh-secret-here'

    let tokenPayload: JWTPayload | null = null

    // Сначала проверяем access token
    if (accessToken) {
      try {
        tokenPayload = jwt.verify(accessToken, jwtSecret) as JWTPayload
      } catch (error) {
        console.log('Access token expired or invalid')
      }
    }

    // Если access token недействителен, проверяем refresh token
    if (!tokenPayload) {
      try {
        tokenPayload = jwt.verify(refreshToken, jwtRefreshSecret) as JWTPayload

        if (tokenPayload.type !== 'refresh') {
          throw new Error('Invalid token type')
        }
      } catch (error) {
        console.error('Refresh token invalid:', error)
        setResponseStatus(event, 401)
        return { error: 'Unauthorized - invalid tokens' }
      }
    }

    if (!tokenPayload) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized - authentication failed' }
    }

    // Подключаемся к Supabase
    const supabase = serverSupabaseServiceRole(event)

    // Получаем пользователя из базы данных
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', tokenPayload.id)
      .single()

    if (userError || !user) {
      console.error('User not found in database:', userError)
      setResponseStatus(event, 401)
      return { error: 'User not found' }
    }

    // Получаем текущее бронирование групповой поездки
    const { data: currentBooking, error: fetchError } = await supabase
      .from('group_trip_bookings')
      .select('*, group_trip:group_trips(*, boat:boats(*))')
      .eq('id', bookingId)
      .single()

    if (fetchError) {
      setResponseStatus(event, 500)
      return { error: 'Error fetching group trip booking', details: fetchError }
    }

    if (!currentBooking) {
      setResponseStatus(event, 404)
      return { error: 'Group trip booking not found' }
    }

    // Проверяем права доступа (владелец бронирования, администратор или менеджер лодки)
    const isAdmin = await checkAdminAccess(supabase, (user as any).id)
    const isManager = await checkManagerAccess(supabase, (user as any).id, (currentBooking as any).group_trip?.boat_id)

    if ((currentBooking as any).user_id !== (user as any).id && !isAdmin && !isManager) {
      setResponseStatus(event, 403)
      return { error: 'Access denied' }
    }

    // Обновляем статус бронирования
    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('group_trip_bookings')
      .update({ status })
      .eq('id', bookingId)
      .select('*, group_trip:group_trips(*, boat:boats(*))')
      .single()

    if (updateError) {
      console.error('Error updating group trip booking status:', updateError)
      setResponseStatus(event, 500)
      return { error: 'Failed to update group trip booking status', details: updateError }
    }

    // Если отменяем бронирование - возвращаем места
    if (status === 'cancelled' && (currentBooking as any).status !== 'cancelled') {
      const totalTickets = (currentBooking as any).adult_count + (currentBooking as any).child_count
      const { data: currentTrip } = await supabase
        .from('group_trips')
        .select('available_seats')
        .eq('id', (currentBooking as any).group_trip_id)
        .single()

      if (currentTrip) {
        await (supabase as any)
          .from('group_trips')
          .update({
            available_seats: (currentTrip as any).available_seats + totalTickets
          })
          .eq('id', (currentBooking as any).group_trip_id)
      }
    }

    // Отправляем уведомления
    if (updatedBooking) {
      try {
        // Получаем данные профиля клиента
        let clientProfile = null
        if ((updatedBooking as any).user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', (updatedBooking as any).user_id)
            .single()
          clientProfile = profile
        }

        // Получаем информацию о менеджере, который изменил статус
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', (user as any).id)
          .single()

        const managerName = (managerProfile as any)?.name || 'Менеджер'

        // Создаем объект бронирования с полными данными для уведомлений
        const bookingWithDetails = {
          ...(updatedBooking as any),
          profile: clientProfile,
          boat: (updatedBooking as any).group_trip?.boat
        }

        // Отправляем уведомление клиенту (если есть telegram_id)
        if ((clientProfile as any)?.telegram_id) {
          const { sendGroupTripStatusNotification } = await import('~/server/utils/telegram-notifications')
          await sendGroupTripStatusNotification(bookingWithDetails, status, managerName)
        }

        // Отправляем уведомление администраторам и менеджерам
        const { formatGroupTripStatusNotification, sendAdminNotification } = await import('~/server/utils/telegram-notifications')
        const notificationMessage = formatGroupTripStatusNotification(bookingWithDetails, status)

        await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: (updatedBooking as any).group_trip?.boat_id,
          event
        })

      } catch (notifyError) {
        console.error('Failed to send group trip status notifications:', notifyError)
        // Не падаем, если уведомления не отправились
      }
    }

    // Возвращаем успешный результат
    setResponseStatus(event, 200)
    return {
      success: true,
      data: updatedBooking,
      message: 'Group trip booking status updated successfully'
    }

  } catch (error) {
    console.error('Error in updating group trip booking status:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error', details: error }
  }
})

// Проверка администраторских прав
async function checkAdminAccess(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    return data?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin access:', error)
    return false
  }
}

// Проверка прав менеджера
async function checkManagerAccess(supabase: any, userId: string, boatId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    // Упрощенная проверка - менеджеры имеют доступ ко всем лодкам
    return data?.role === 'manager'
  } catch (error) {
    console.error('Error checking manager access:', error)
    return false
  }
}
