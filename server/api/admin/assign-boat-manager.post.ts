import { defineEventHandler, readBody, getCookie, setResponseStatus } from 'h3'
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
    const body = await readBody(event)
    const { boat_id, user_id } = body

    if (!boat_id || !user_id) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Boat ID and User ID are required' }
    }

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

    // Проверяем, что такая связь не существует
    const { data: existing } = await (supabase as any)
      .from('boat_managers')
      .select('id')
      .eq('boat_id', boat_id)
      .eq('user_id', user_id)
      .single()

    if (existing) {
      setResponseStatus(event, 400)
      return { success: false, error: 'User is already a manager of this boat' }
    }

    // Добавляем менеджера
    const { data: manager, error } = await (supabase as any)
      .from('boat_managers')
      .insert({
        boat_id,
        user_id
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error assigning boat manager:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to assign boat manager' }
    }

    return {
      success: true,
      data: manager
    }

  } catch (error: any) {
    console.error('Assign boat manager API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
