import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const boatId = getRouterParam(event, 'id')
    const query = getQuery(event)

    // Валидация входных параметров
    if (!boatId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Boat ID is required'
      })
    }

    const dateStr = query.date as string
    if (!dateStr) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Date parameter is required'
      })
    }

    // Валидация формата даты
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateStr)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid date format. Expected YYYY-MM-DD'
      })
    }

    // Используем service role, так как этот endpoint используется менеджерами
    // и должен обходить RLS ограничения
    const supabase = serverSupabaseServiceRole(event)

    // Создаём диапазон дат
    const dayStart = new Date(dateStr + 'T00:00:00.000Z')
    const nextDay = new Date(dayStart)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)

    // Проверяем валидность дат
    if (isNaN(dayStart.getTime()) || isNaN(nextDay.getTime())) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid date value'
      })
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(name, phone)')
      .eq('boat_id', boatId)
      .gte('start_time', dayStart.toISOString())
      .lt('start_time', nextDay.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      console.error('Error fetching bookings:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch bookings',
        data: { details: error.message }
      })
    }

    return {
      success: true,
      bookings: data || []
    }
  } catch (error: any) {
    // Если это уже H3Error, пробрасываем дальше
    if (error.statusCode) {
      throw error
    }

    // Обрабатываем другие ошибки
    console.error('Unexpected error in bookings endpoint:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
      data: { details: error.message }
    })
  }
})
