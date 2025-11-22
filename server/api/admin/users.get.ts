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

    // Получаем всех пользователей
    const { data: users, error } = await (supabase as any)
      .from('profiles')
      .select('id, name, email, telegram_id, phone, role')
      .order('name')

    if (error) {
      console.error('Error fetching users:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to fetch users' }
    }

    return {
      success: true,
      data: users || []
    }

  } catch (error: any) {
    console.error('Admin users API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
