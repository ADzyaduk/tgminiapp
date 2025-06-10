import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const boatId = getRouterParam(event, 'id')
  const query = getQuery(event)

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

  const supabase = serverSupabaseServiceRole(event)

  try {
    // Создаём диапазон дат точно как в debug endpoint'е
    const dayStart = new Date(dateStr + 'T00:00:00.000Z')
    const nextDay = new Date(dayStart)
    nextDay.setUTCDate(nextDay.getUTCDate() + 1)



    const { data, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(name, phone)')
      .eq('boat_id', boatId)
      .gte('start_time', dayStart.toISOString())
      .lt('start_time', nextDay.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch bookings'
      })
    }

    return {
      success: true,
      bookings: data || []
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})
