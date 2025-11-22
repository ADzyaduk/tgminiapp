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
 * API для синхронизации Telegram ID пользователя с профилем
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { telegram_user } = body

    if (!telegram_user || !telegram_user.id) {
      return { status: 400, body: { error: 'Telegram user data required' } }
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

    // Обновляем профиль пользователя, добавляя Telegram ID
    const { error } = await (supabase as any)
      .from('profiles')
      .update({
        telegram_id: telegram_user.id.toString(),
        telegram_username: telegram_user.username || null,
        telegram_first_name: telegram_user.first_name || null,
        telegram_last_name: telegram_user.last_name || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', (user as any).id)

    if (error) {
      console.error('Error updating profile with telegram data:', error)
      return { status: 500, body: { error: 'Failed to sync telegram data' } }
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Telegram data synced successfully',
        telegram_id: telegram_user.id.toString()
      }
    }
  } catch (error) {
    console.error('Error in telegram sync:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})
