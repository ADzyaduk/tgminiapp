import { defineEventHandler, readBody, getCookie, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  id: string
  telegram_id: string
  name: string
  role: string
  exp?: number
}

interface UpdateProfileRequest {
  name?: string
  email?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) as UpdateProfileRequest
    const { name, email } = body

    // Проверяем что есть хотя бы одно поле для обновления
    if (!name && !email) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Name or email is required' }
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

    // Подготавливаем данные для обновления
    const updateData: Partial<{ name: string; email: string; updated_at: string }> = {
      updated_at: new Date().toISOString()
    }

    if (name?.trim()) {
      updateData.name = name.trim()
    }

    if (email?.trim()) {
      updateData.email = email.trim()
    }

    // Обновляем профиль в базе данных
    const supabase = serverSupabaseServiceRole(event)
    const { data: updatedUser, error } = await (supabase as any)
      .from('profiles')
      .update(updateData)
      .eq('id', tokenPayload.id)
      .select('*')
      .single()

    if (error) {
      console.error('❌ Error updating profile:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to update profile' }
    }

    console.log('✅ Profile updated successfully for user:', tokenPayload.telegram_id)

    return {
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    }

  } catch (error: any) {
    console.error('❌ Update profile error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
