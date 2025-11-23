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
        // Используем process.env напрямую, так как runtimeConfig может не подхватить переменные без префикса
        const jwtSecret = config.jwtSecret || process.env.JWT_SECRET
        const jwtRefreshSecret = config.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET

        if (jwtSecret && jwtRefreshSecret) {
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
      .select('*')
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
      console.log('🔔 Starting notifications for booking:', (booking as any).id)
      console.log('📋 Booking data:', booking)

      // Получаем данные профиля и лодки для уведомлений
      let profile = null
      let boat = null

      if ((booking as any).user_id) {
        console.log('👤 Getting profile for user_id:', (booking as any).user_id)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, telegram_id, phone, email')
          .eq('id', (booking as any).user_id)
          .single()
        profile = profileData
        console.log('👤 Profile data:', profile)
      }

      if ((booking as any).boat_id) {
        console.log('🚤 Getting boat for boat_id:', (booking as any).boat_id)
        const { data: boatData } = await supabase
          .from('boats')
          .select('name')
          .eq('id', (booking as any).boat_id)
          .single()
        boat = boatData
        console.log('🚤 Boat data:', boat)
      }

      // Добавляем данные в объект бронирования для уведомлений
      const bookingWithDetails = {
        ...(booking as any),
        profile: profile,
        boat: boat
      }

      console.log('📦 Full booking with details:', bookingWithDetails)

      // Отправляем улучшенное уведомление менеджерам
      const enhancedMessage = formatBookingNotificationEnhanced(bookingWithDetails)
      console.log('📝 Enhanced message created:', enhancedMessage.substring(0, 200) + '...')

      console.log('📤 Calling sendAdminNotification with params:', {
        boatId: (booking as any).boat_id,
        bookingId: (booking as any).id,
        bookingType: 'regular'
      })

      const notificationResult = await sendAdminNotification(enhancedMessage, {
        parseMode: 'HTML',
        boatId: (booking as any).boat_id,
        bookingId: (booking as any).id,
        bookingType: 'regular',
        event,
        withButtons: true
      })

      console.log('📨 Notification result:', notificationResult)

      // Отправляем подтверждение клиенту (если есть telegram_id)
      if (profile && (profile as any).telegram_id) {
        console.log('📱 Sending client confirmation to:', (profile as any).telegram_id)
        const clientResult = await sendClientBookingConfirmation(bookingWithDetails)
        console.log('📱 Client notification result:', clientResult)
      } else {
        console.log('❌ No telegram_id for client notification')
      }

    } catch (notifyError) {
      console.error('❌ Failed to send notifications:', notifyError)
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
