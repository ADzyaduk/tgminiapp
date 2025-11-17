import { defineEventHandler, getCookie, setCookie, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { generateTokens } from '~/server/utils/jwt'

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
    const supabase = serverSupabaseServiceRole(event)

    // Получаем всех пользователей с Telegram ID и правами
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, telegram_id, role')
      .not('telegram_id', 'is', null)
      .in('role', ['admin', 'agent', 'manager'])

    if (error) {
      return { error: 'Database error', details: error.message }
    }

    return {
      success: true,
      count: users.length,
      users: users.map((user: any) => ({
        id: user.id,
        name: user.name,
        telegram_id: user.telegram_id,
        role: user.role
      }))
    }

  } catch (error) {
    console.error('Auth check error:', error)
    return { error: 'Server error', details: String(error) }
  }
})

// Функция generateTokens теперь импортируется из server/utils/jwt.ts

// Установка cookies
function setCookies(event: any, tokens: { accessToken: string; refreshToken: string }) {
  const config = useRuntimeConfig()
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
