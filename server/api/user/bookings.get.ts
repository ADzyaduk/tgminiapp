import { defineEventHandler, getCookie, setResponseStatus } from 'h3'
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

    // Получаем бронирования пользователя (обычные бронирования)
    const { data: regularBookings, error: regularError } = await supabase
      .from('bookings')
      .select('*, boat:boat_id(name)')
      .eq('user_id', (user as any).id)
      .order('created_at', { ascending: false })

    if (regularError) {
      console.error('Error fetching regular bookings:', regularError)
      setResponseStatus(event, 500)
      return { error: 'Failed to fetch regular bookings', details: regularError }
    }

    // Получаем бронирования групповых поездок
    const { data: groupBookings, error: groupError } = await supabase
      .from('group_trip_bookings')
      .select(`
        *,
        group_trips!inner(
          name,
          start_time,
          end_time,
          boat:boats(name)
        )
      `)
      .eq('user_id', (user as any).id)
      .order('created_at', { ascending: false })

    if (groupError) {
      console.error('Error fetching group bookings:', groupError)
      setResponseStatus(event, 500)
      return { error: 'Failed to fetch group bookings', details: groupError }
    }

    // Форматируем бронирования для унифицированного отображения
    const formattedRegularBookings = (regularBookings || []).map((booking: any) => ({
      ...booking,
      type: 'regular',
      boat_name: booking.boat?.name || 'Неизвестная лодка',
      formatted_start_time: booking.start_time,
      formatted_end_time: booking.end_time
    }))

    const formattedGroupBookings = (groupBookings || []).map((booking: any) => ({
      ...booking,
      type: 'group_trip',
      boat_name: booking.group_trips?.boat?.name || 'Неизвестная лодка',
      formatted_start_time: booking.group_trips?.start_time,
      formatted_end_time: booking.group_trips?.end_time,
      start_time: booking.group_trips?.start_time,
      end_time: booking.group_trips?.end_time,
      price: booking.total_price,
      guest_name: booking.guest_name
    }))

    // Объединяем и сортируем все бронирования по дате создания
    const allBookings = [...formattedRegularBookings, ...formattedGroupBookings]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setResponseStatus(event, 200)
    return {
      success: true,
      data: allBookings,
      count: {
        total: allBookings.length,
        regular: formattedRegularBookings.length,
        group: formattedGroupBookings.length
      }
    }

  } catch (error) {
    console.error('Error in user bookings endpoint:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error', details: (error as Error).message }
  }
})
