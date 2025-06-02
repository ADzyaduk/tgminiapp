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

    // Удаляем менеджера
    const { error } = await (supabase as any)
      .from('boat_managers')
      .delete()
      .eq('boat_id', boat_id)
      .eq('user_id', user_id)

    if (error) {
      console.error('Error removing boat manager:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to remove boat manager' }
    }

    return {
      success: true,
      message: 'Boat manager removed successfully'
    }

  } catch (error: any) {
    console.error('Remove boat manager API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
