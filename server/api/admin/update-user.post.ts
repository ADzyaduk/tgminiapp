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
    const { id, field, value } = body

    if (!id || !field) {
      setResponseStatus(event, 400)
      return { success: false, error: 'User ID and field are required' }
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

    // Обновляем поле пользователя
    const updateData = { [field]: value }

    const { data: updatedUser, error } = await (supabase as any)
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Error updating user:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to update user' }
    }

    console.log(`✅ User updated: ${field} = ${value}`)

    return {
      success: true,
      data: updatedUser
    }

  } catch (error: any) {
    console.error('Update user API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
