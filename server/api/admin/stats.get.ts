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

    // Проверяем права админа
    // Модуль @nuxtjs/supabase автоматически использует SUPABASE_SERVICE_KEY из process.env
    const supabase = serverSupabaseServiceRole(event)
    
    if (!supabase) {
      console.error('Failed to create Supabase service role client. Check SUPABASE_SERVICE_KEY in process.env')
      setResponseStatus(event, 500)
      return { success: false, error: 'Database connection failed' }
    }

    const { data: adminUser, error: adminError } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', tokenPayload.id)
      .single()

    if (adminError) {
      console.error('Error checking admin user:', adminError)
      setResponseStatus(event, 500)
      return { success: false, error: 'Database error' }
    }

    if (!adminUser || adminUser.role !== 'admin') {
      setResponseStatus(event, 403)
      return { success: false, error: 'Admin access required' }
    }

    // Получаем статистику
    const { data: allUsers, error: usersError } = await (supabase as any)
      .from('profiles')
      .select('role, telegram_id')

    if (usersError) {
      console.error('Error fetching users for stats:', usersError)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to fetch users' }
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
