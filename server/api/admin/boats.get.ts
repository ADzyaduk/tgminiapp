import { defineEventHandler, getCookie, setResponseStatus } from 'h3'
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

    // Получаем список лодок с проверкой всех возможных полей
    let { data: boats, error } = await (supabase as any)
      .from('boats')
      .select('id, name')
      .order('name')

    // Если произошла ошибка с именем, попробуем другую схему
    if (error && error.message?.includes('column "name" does not exist')) {
      const { data: boats2, error: error2 } = await (supabase as any)
        .from('boats')
        .select('*')
        .limit(10)

      if (error2) {
        console.error('Error fetching boats (both attempts):', error, error2)
        setResponseStatus(event, 500)
        return { success: false, error: 'Failed to fetch boats' }
      }

      // Преобразуем данные в нужный формат
      boats = boats2?.map((boat: any) => ({
        id: boat.id,
        name: boat.name || boat.slug || `Boat ${boat.id}`
      })) || []
    } else if (error) {
      console.error('Error fetching boats:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to fetch boats' }
    }

    return {
      success: true,
      data: boats || []
    }

  } catch (error: any) {
    console.error('Boats API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
