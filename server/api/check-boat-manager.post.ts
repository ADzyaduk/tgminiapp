import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { boat_id, user_id } = body

    if (!boat_id || !user_id) {
      setResponseStatus(event, 400)
      return { isManager: false, error: 'Boat ID and User ID are required' }
    }

    const supabase = serverSupabaseServiceRole(event)

    // Проверяем, есть ли такая связь в таблице boat_managers
    const { data: manager, error } = await (supabase as any)
      .from('boat_managers')
      .select('id')
      .eq('boat_id', boat_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (error) {
      console.error('Error checking boat manager:', error)
      // Если таблица не существует, возвращаем false
      if (error.message?.includes('relation "boat_managers" does not exist')) {
        return { isManager: false }
      }
      setResponseStatus(event, 500)
      return { isManager: false, error: 'Failed to check manager status' }
    }

    return {
      isManager: !!manager
    }

  } catch (error: any) {
    console.error('Check boat manager API error:', error)
    setResponseStatus(event, 500)
    return { isManager: false, error: 'Internal server error' }
  }
})
