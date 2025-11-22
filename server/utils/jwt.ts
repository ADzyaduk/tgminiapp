import jwt from 'jsonwebtoken'

export interface JWTPayload {
  id: string
  telegram_id: string
  role: string
  type: 'access' | 'refresh'
  iat?: number
  exp?: number
}

export interface UserTokenData {
  id: string
  telegram_id: string
  role: string
}

/**
 * Генерация JWT токенов (access и refresh)
 * @param user - Данные пользователя
 * @param config - Конфигурация runtime (содержит jwtSecret и jwtRefreshSecret)
 * @returns Объект с accessToken и refreshToken
 */
export function generateTokens(user: UserTokenData, config: { jwtSecret?: string; jwtRefreshSecret?: string }) {
  // Используем process.env как fallback, если секреты не переданы в config
  const jwtSecret = config.jwtSecret || process.env.JWT_SECRET || ''
  // Если jwtRefreshSecret не указан, используем тот же секрет (упрощенный вариант)
  const jwtRefreshSecret = config.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET || jwtSecret

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured')
  }

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

/**
 * Верификация JWT токена
 * @param token - JWT токен для проверки
 * @param secret - Секретный ключ для проверки
 * @returns Payload токена или null при ошибке
 */
export function verifyToken(token: string, secret: string): JWTPayload | null {
  try {
    return jwt.verify(token, secret) as JWTPayload
  } catch (error) {
    return null
  }
}

/**
 * Получение payload из access или refresh токена
 * @param accessToken - Access токен
 * @param refreshToken - Refresh токен
 * @param config - Конфигурация runtime
 * @returns Payload токена или null
 */
export function getTokenPayload(
  accessToken: string | undefined,
  refreshToken: string | undefined,
  config: { jwtSecret?: string; jwtRefreshSecret?: string }
): JWTPayload | null {
  // Используем process.env как fallback, если секреты не переданы в config
  const jwtSecret = config.jwtSecret || process.env.JWT_SECRET || ''
  const jwtRefreshSecret = config.jwtRefreshSecret || process.env.JWT_REFRESH_SECRET || jwtSecret

  if (!jwtSecret) {
    console.error('JWT_SECRET not configured in getTokenPayload')
    return null
  }

  // Сначала проверяем access token
  if (accessToken) {
    const payload = verifyToken(accessToken, jwtSecret)
    if (payload && payload.type === 'access') {
      return payload
    }
  }

  // Если access token недействителен, проверяем refresh token
  if (refreshToken) {
    const payload = verifyToken(refreshToken, jwtRefreshSecret)
    if (payload && payload.type === 'refresh') {
      return payload
    }
  }

  return null
}

