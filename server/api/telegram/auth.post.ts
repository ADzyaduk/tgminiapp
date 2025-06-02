import { defineEventHandler, readBody, setCookie, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface InitDataParsed {
  user?: TelegramUser
  auth_date?: number
  hash?: string
  [key: string]: any
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { initData } = body

    if (!initData) {
      setResponseStatus(event, 400)
      return { success: false, error: 'initData is required' }
    }

    console.log('🔐 Processing Telegram auth request...')

    // Парсим initData
    const parsedData = parseInitData(initData)

    if (!parsedData.user) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid initData: user not found' }
    }

    // Валидируем initData (в development режиме пропускаем валидацию)
    const config = useRuntimeConfig()
    const isDev = config.public.isTelegramDevMode

    if (!isDev) {
      const isValid = validateInitData(initData, config.telegramBotToken)
      if (!isValid) {
        setResponseStatus(event, 401)
        return { success: false, error: 'Invalid initData signature' }
      }
    }

    const telegramUser = parsedData.user
    const supabase = serverSupabaseServiceRole(event)

    // Ищем пользователя в базе данных
    let user = await findOrCreateUser(supabase, telegramUser)

    if (!user) {
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to create user' }
    }

    // Генерируем JWT токены
    const tokens = generateTokens(user, config)

    // Устанавливаем токены в cookies
    setCookies(event, tokens)

    console.log('✅ Telegram auth successful for user:', user.telegram_id)

    return {
      success: true,
      profile: user,
      telegramUser
    }

  } catch (error: any) {
    console.error('❌ Telegram auth error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})

// Парсинг initData
function parseInitData(initData: string): InitDataParsed {
  const params = new URLSearchParams(initData)
  const result: InitDataParsed = {}

  for (const [key, value] of params.entries()) {
    if (key === 'user') {
      try {
        result.user = JSON.parse(decodeURIComponent(value))
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    } else if (key === 'auth_date') {
      result.auth_date = parseInt(value)
    } else {
      result[key] = value
    }
  }

  return result
}

// Валидация initData согласно документации Telegram
function validateInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')

    if (!hash) return false

    // Удаляем hash из параметров для проверки
    params.delete('hash')

    // Сортируем параметры и создаем строку для проверки
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    // Создаем секретный ключ из токена бота
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest()

    // Вычисляем HMAC для проверки
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(sortedParams)
      .digest('hex')

    return calculatedHash === hash
  } catch (error) {
    console.error('Error validating initData:', error)
    return false
  }
}

// Поиск или создание пользователя
async function findOrCreateUser(supabase: any, telegramUser: TelegramUser) {
  try {
    // Ищем существующего пользователя по telegram_id
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramUser.id.toString())
      .single()

    if (existingUser) {
      // Обновляем данные пользователя (имя могло измениться)
      const { data: updatedUser } = await supabase
        .from('profiles')
        .update({
          name: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || telegramUser.username || 'Telegram User'
        })
        .eq('telegram_id', telegramUser.id.toString())
        .select('*')
        .single()

      return updatedUser || existingUser
    }

    // Создаем нового пользователя
    const newUserData = {
      id: crypto.randomUUID(),
      telegram_id: telegramUser.id.toString(),
      name: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() || telegramUser.username || 'Telegram User',
      email: telegramUser.username ? `${telegramUser.username}@telegram.local` : `telegram_${telegramUser.id}@local`,
      role: 'user'
    }

    const { data: newUser, error } = await supabase
      .from('profiles')
      .insert(newUserData)
      .select('*')
      .single()

    if (error) {
      console.error('Error creating user:', error)
      return null
    }

    return newUser

  } catch (error) {
    console.error('Error in findOrCreateUser:', error)
    return null
  }
}

// Генерация JWT токенов
function generateTokens(user: any, config: any) {
  const jwtSecret = config.jwtSecret || 'your-jwt-secret-here'
  const jwtRefreshSecret = config.jwtRefreshSecret || 'your-refresh-secret-here'

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
