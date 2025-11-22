import { defineEventHandler, readBody, getCookie } from 'h3'
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

/**
 * API для связки существующего аккаунта с Telegram ID
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { telegram_id } = body

    if (!telegram_id) {
      return { status: 400, body: { error: 'Telegram ID required' } }
    }

    // Получаем текущего авторизованного пользователя через JWT токены
    const accessToken = getCookie(event, 'tg-access-token')
    const refreshToken = getCookie(event, 'tg-refresh-token')

    if (!refreshToken) {
      return { status: 401, body: { error: 'User not authenticated - no refresh token' } }
    }

    const config = useRuntimeConfig()
    // Используем process.env напрямую, так как runtimeConfig может не подхватить переменные без префикса
    const jwtSecret = config.jwtSecret || process.env.JWT_SECRET
    const jwtRefreshSecret = config.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET

    if (!jwtSecret || !jwtRefreshSecret) {
      console.error('JWT secrets not configured')
      return { status: 500, body: { error: 'JWT secrets not configured' } }
    }

    let tokenPayload: JWTPayload | null = null

    // Сначала проверяем access token
    if (accessToken) {
      try {
        tokenPayload = jwt.verify(accessToken, jwtSecret) as JWTPayload
      } catch (error) {
        // Access token expired or invalid
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
        return { status: 401, body: { error: 'User not authenticated - invalid tokens' } }
      }
    }

    if (!tokenPayload) {
      return { status: 401, body: { error: 'User not authenticated' } }
    }

    const supabase = serverSupabaseServiceRole(event)

    // Получаем пользователя из базы данных
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', tokenPayload.id)
      .single()

    if (userError || !user) {
      return { status: 401, body: { error: 'User not found' } }
    }

    // Проверяем что этот Telegram ID не занят другим пользователем
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('telegram_id', telegram_id)
      .neq('id', (user as any).id)
      .single()

    if (existingUser) {
      return {
        status: 409,
        body: {
          error: 'Этот Telegram ID уже привязан к другому аккаунту',
          existing_email: (existingUser as any).email
        }
      }
    }

    // Обновляем профиль пользователя, добавляя Telegram ID
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        telegram_id: telegram_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', (user as any).id)

    if (error) {
      console.error('Error linking telegram account:', error)
      return { status: 500, body: { error: 'Failed to link telegram account' } }
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Telegram аккаунт успешно привязан',
        telegram_id: telegram_id
      }
    }
  } catch (error) {
    console.error('Error in telegram link:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})
