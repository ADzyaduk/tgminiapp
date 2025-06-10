import { defineEventHandler, readBody, getCookie } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import jwt from 'jsonwebtoken'
import {
  formatBookingNotification,
  formatBookingNotificationEnhanced,
  sendAdminNotification,
  sendClientBookingConfirmation
} from '~/server/utils/telegram-notifications'

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
    // Получаем данные бронирования из запроса
    const body = await readBody(event)

    // Проверяем авторизацию пользователя (но не блокируем если не авторизован)
    let user = null
    try {
      const accessToken = getCookie(event, 'tg-access-token')
      const refreshToken = getCookie(event, 'tg-refresh-token')

      if (refreshToken) {
        const config = useRuntimeConfig()
        const jwtSecret = config.jwtSecret || 'your-jwt-secret-here'
        const jwtRefreshSecret = config.jwtRefreshSecret || 'your-refresh-secret-here'

        let tokenPayload: JWTPayload | null = null

        // Сначала проверяем access token
        if (accessToken) {
          try {
            tokenPayload = jwt.verify(accessToken, jwtSecret) as JWTPayload
          } catch (error) {
            // Access token expired or invalid
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
            // Refresh token invalid, continue as anonymous
          }
        }

        if (tokenPayload) {
          // Получаем пользователя из базы данных
          const supabase = serverSupabaseServiceRole(event)
          const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', tokenPayload.id)
            .single()

          if (!userError && userData) {
            user = userData
          }
        }
      }
    } catch (error) {
      // Continue as anonymous user
    }

    // Подключаемся к Supabase
    const supabase = serverSupabaseServiceRole(event)

    // Создаем запись о бронировании
    const { data: booking, error } = await (supabase as any)
      .from('bookings')
      .insert({
        ...body,
        user_id: user ? (user as any).id : null, // Добавляем ID пользователя только если пользователь авторизован
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
