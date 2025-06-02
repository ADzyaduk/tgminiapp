import { defineEventHandler, getCookie, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  id: string
  telegram_id: string
  role: string
  type: string
}

export default defineEventHandler(async (event) => {
  try {
    // Проверяем JWT токен
    const accessToken = getCookie(event, 'tg-access-token')

    if (!accessToken) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Authentication required' }
    }

    const config = useRuntimeConfig()
    const jwtSecret = config.jwtSecret || 'your-jwt-secret-here'

    let tokenPayload: JWTPayload
    try {
      tokenPayload = jwt.verify(accessToken, jwtSecret) as JWTPayload
    } catch (error) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Invalid token' }
    }

    // Проверяем права админа
    const supabase = serverSupabaseServiceRole(event)
    const { data: adminUser } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', tokenPayload.id)
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      setResponseStatus(event, 403)
      return { success: false, error: 'Admin access required' }
    }

    // Получаем статистику
    const { data: allUsers } = await (supabase as any)
      .from('profiles')
      .select('role, telegram_id')

    if (!allUsers) {
      return {
        success: true,
        data: {
          totalUsers: 0,
          telegramUsers: 0,
          admins: 0,
          agents: 0,
          managers: 0
        }
      }
    }

    const stats = {
      totalUsers: allUsers.length,
      telegramUsers: allUsers.filter((u: any) => u.telegram_id).length,
      admins: allUsers.filter((u: any) => u.role === 'admin').length,
      agents: allUsers.filter((u: any) => u.role === 'agent').length,
      managers: allUsers.filter((u: any) => u.role === 'boat_manager').length
    }

    return {
      success: true,
      data: stats
    }

  } catch (error: any) {
    console.error('Admin stats API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
