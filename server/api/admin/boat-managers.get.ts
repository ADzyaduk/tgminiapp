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

    // Проверяем, что таблица boat_managers существует
    const { data: tableExists } = await (supabase as any)
      .from('boat_managers')
      .select('count')
      .limit(0)

    // Если таблица не существует, возвращаем пустой массив
    if (!tableExists && tableExists !== null) {
      return {
        success: true,
        data: []
      }
    }

    // Получаем список менеджеров лодки
    const { data: managers, error } = await (supabase as any)
      .from('boat_managers')
      .select('boat_id, user_id')

    if (error) {
      console.error('Error fetching boat managers:', error)

      // Если таблица не существует, возвращаем пустой массив вместо ошибки
      if (error.message?.includes('relation "boat_managers" does not exist')) {
        return {
          success: true,
          data: []
        }
      }

      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to fetch boat managers' }
    }

    // Если нет менеджеров, возвращаем пустой массив
    if (!managers || managers.length === 0) {
      return {
        success: true,
        data: []
      }
    }

    // Получаем уникальные ID лодок и пользователей
    const boatIds = [...new Set(managers.map((m: any) => m.boat_id))]
    const userIds = [...new Set(managers.map((m: any) => m.user_id))]

    // Получаем данные лодок
    const { data: boats } = await (supabase as any)
      .from('boats')
      .select('id, name')
      .in('id', boatIds)

    // Получаем данные пользователей
    const { data: users } = await (supabase as any)
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds)

    // Создаем мапы для быстрого поиска
    const boatMap = new Map()
    boats?.forEach((boat: any) => {
      boatMap.set(boat.id, boat.name)
    })

    const userMap = new Map()
    users?.forEach((user: any) => {
      userMap.set(user.id, user.name || user.email || 'Unknown user')
    })

    // Форматируем данные
    const formattedManagers = managers.map((manager: any) => ({
      boat_id: manager.boat_id,
      user_id: manager.user_id,
      boat_name: boatMap.get(manager.boat_id) || 'Unknown boat',
      user_name: userMap.get(manager.user_id) || 'Unknown user'
    }))

    return {
      success: true,
      data: formattedManagers
    }

  } catch (error: any) {
    console.error('Boat managers API error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
