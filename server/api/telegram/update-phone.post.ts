import { defineEventHandler, readBody, getCookie, setResponseStatus } from 'h3'
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
    const body = await readBody(event)
    const { phone } = body

    if (!phone) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Phone number is required' }
    }

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

    // Обновляем номер телефона в базе данных
    const supabase = serverSupabaseServiceRole(event)
    const { data: updatedUser, error } = await (supabase as any)
      .from('profiles')
      .update({
        phone
      })
      .eq('id', tokenPayload.id)
      .select('*')
      .single()

    if (error) {
      console.error('❌ Error updating phone:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to update phone number' }
    }

    console.log('✅ Phone updated successfully for user:', tokenPayload.telegram_id)

    return {
      success: true,
      message: 'Phone number updated successfully',
      user: updatedUser
    }

  } catch (error: any) {
    console.error('❌ Update phone error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
