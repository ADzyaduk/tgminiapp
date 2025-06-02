import { defineEventHandler, getCookie, setResponseStatus } from 'h3'
import jwt from 'jsonwebtoken'

interface JWTPayload {
  id: string
  telegram_id: string
  role: string
  type: string
}

export default defineEventHandler(async (event) => {
  try {
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

    // Для JWT токенов нет централизованного хранилища сессий
    // Это заглушка, в реальности токены истекают автоматически
    const deletedCount = 0

    console.log('✅ Session cleanup completed (JWT tokens expire automatically)')

    return {
      success: true,
      data: { deletedCount }
    }

  } catch (error: any) {
    console.error('Clean sessions API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
