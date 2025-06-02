import { defineEventHandler, getCookie, setCookie, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import * as jwt from 'jsonwebtoken'

interface JWTPayload {
  id: string
  telegram_id: string
  role: string
  type: string
  iat?: number
  exp?: number
}

interface UserProfile {
  id: string
  telegram_id: string
  name?: string
  email?: string
  role: string
  [key: string]: any
}

export default defineEventHandler(async (event) => {
  try {
    const accessToken = getCookie(event, 'tg-access-token')
    const refreshToken = getCookie(event, 'tg-refresh-token')

    if (!refreshToken) {
      setResponseStatus(event, 401)
      return { success: false, error: 'No refresh token found' }
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-here'
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-here'

    let tokenPayload: JWTPayload | null = null

    // Сначала проверяем access token
    if (accessToken) {
      try {
        tokenPayload = jwt.verify(accessToken, jwtSecret) as JWTPayload
        console.log('✅ Valid access token found')
      } catch (error) {
        console.log('❌ Access token expired or invalid')
      }
    }

    // Если access token недействителен, проверяем refresh token
    if (!tokenPayload) {
      try {
        tokenPayload = jwt.verify(refreshToken, jwtRefreshSecret) as JWTPayload

        if (tokenPayload.type !== 'refresh') {
          throw new Error('Invalid token type')
        }

        console.log('🔄 Refreshing tokens...')

        // Генерируем новые токены
        const newTokens = generateTokens({
          id: tokenPayload.id,
          telegram_id: tokenPayload.telegram_id,
          role: tokenPayload.role
        })

        // Устанавливаем новые токены в cookies
        setCookies(event, newTokens)

      } catch (error) {
        console.error('❌ Refresh token invalid:', error)
        setResponseStatus(event, 401)
        return { success: false, error: 'Invalid refresh token' }
      }
    }

    if (!tokenPayload) {
      setResponseStatus(event, 401)
      return { success: false, error: 'Authentication failed' }
    }

    // Получаем пользователя из базы данных
    const supabase = serverSupabaseServiceRole(event)
    const { data: user, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', tokenPayload.id)
      .single()

    if (error || !user) {
      console.error('❌ User not found in database:', error)
      setResponseStatus(event, 404)
      return { success: false, error: 'User not found' }
    }

    const userProfile = user as UserProfile

    console.log('✅ Auth check successful for user:', userProfile.telegram_id)

    return {
      success: true,
      user: userProfile,
      telegramUser: {
        id: parseInt(userProfile.telegram_id),
        first_name: userProfile.name?.split(' ')[0] || '',
        last_name: userProfile.name?.split(' ')[1] || '',
        username: userProfile.email?.split('@')[0] || ''
      }
    }

  } catch (error: any) {
    console.error('❌ Auth check error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})

// Генерация JWT токенов
function generateTokens(user: any) {
  const jwtSecret = process.env.JWT_SECRET || 'your-jwt-secret-here'
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-here'

  const accessToken = jwt.sign(
    {
      id: user.id,
      telegram_id: user.telegram_id,
      role: user.role,
      type: 'access'
    },
    jwtSecret,
    { expiresIn: '15m' }
  )

  const refreshToken = jwt.sign(
    {
      id: user.id,
      telegram_id: user.telegram_id,
      role: user.role,
      type: 'refresh'
    },
    jwtRefreshSecret,
    { expiresIn: '7d' }
  )

  return { accessToken, refreshToken }
}

// Установка cookies
function setCookies(event: any, tokens: { accessToken: string; refreshToken: string }) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 // 7 дней
  }

  setCookie(event, 'tg-access-token', tokens.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 // 15 минут
  })

  setCookie(event, 'tg-refresh-token', tokens.refreshToken, cookieOptions)
}
