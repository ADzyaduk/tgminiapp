import { defineEventHandler, getCookie, setResponseStatus } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  id: string
  telegram_id: string
  name: string
  role: string
  exp?: number
}

interface BookingStat {
  id: string
  price: number
  status: string
}

interface GroupStat {
  id: string
  total_price: number
      status: string
}

export default defineEventHandler(async (event) => {
  try {
    // Получаем access token из cookies
    const accessToken = getCookie(event, 'tg-access-token')

    if (!accessToken) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Authentication required' }
    }

    // Проверяем токен
    const config = useRuntimeConfig()
    // Используем process.env напрямую, так как runtimeConfig может не подхватить переменную без префикса
    const jwtSecret = config.jwtSecret || process.env.JWT_SECRET

    if (!jwtSecret) {
      console.error('JWT_SECRET not configured')
      setResponseStatus(event, 500)
      return { success: false, error: 'JWT secret not configured' }
    }

    let tokenPayload: JWTPayload
    try {
      tokenPayload = jwt.verify(accessToken, jwtSecret) as JWTPayload
    } catch (error) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Invalid token' }
    }

    // Подключаемся к Supabase с обычным client (пользователь уже аутентифицирован через JWT)
    const supabase = await serverSupabaseClient(event)
    const userId = tokenPayload.id

    // Получаем статистику по обычным бронированиям
    const { data: bookingStats, error: bookingError } = await supabase
      .from('bookings')
      .select('id, price, status')
      .eq('user_id', userId)

    if (bookingError) {
      console.error('❌ Error getting booking stats:', bookingError)
      // Продолжаем работу, но возвращаем пустую статистику при ошибке
    }

    // Получаем статистику по групповым турам
    const { data: groupStats, error: groupError } = await supabase
      .from('group_trip_bookings')
      .select('id, total_price, status')
      .eq('user_id', userId)

    if (groupError) {
      console.error('❌ Error getting group stats:', groupError)
      // Продолжаем работу, но возвращаем пустую статистику при ошибке
    }

    // Вычисляем статистику
    const bookings = (bookingStats || []) as BookingStat[]
    const groupBookings = (groupStats || []) as GroupStat[]

    const totalBookings = bookings.length + groupBookings.length
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length +
                             groupBookings.filter(b => b.status === 'confirmed').length

    const totalSpent = bookings.reduce((sum, b) => sum + (b.price || 0), 0) +
                      groupBookings.reduce((sum, b) => sum + (b.total_price || 0), 0)

    // Статистика для агентов/менеджеров
    let agentStats = { thisMonth: 0, revenue: 0 }

    if (['admin', 'manager', 'agent'].includes(tokenPayload.role)) {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      // Бронирования за этот месяц (созданные этим пользователем)
      const { data: monthlyBookings } = await supabase
        .from('bookings')
        .select('id, price')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())

      const monthlyData = (monthlyBookings || []) as BookingStat[]
      agentStats = {
        thisMonth: monthlyData.length,
        revenue: monthlyData.reduce((sum, b) => sum + (b.price || 0), 0)
      }
    }

    return {
      success: true,
      stats: {
        totalBookings,
        confirmedBookings,
        totalSpent
      },
      agentStats
    }

  } catch (error: any) {
    console.error('❌ Get user stats error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
