import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    // Получаем последние 10 бронирований
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, guest_name, start_time, status, boat_id')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return {
        success: false,
        error: 'Failed to fetch bookings',
        details: error
      }
    }

    return {
      success: true,
      count: bookings?.length || 0,
      bookings: bookings?.map((booking: any) => ({
        id: booking.id,
        guest_name: booking.guest_name,
        start_time: booking.start_time,
        status: booking.status,
        boat_id: booking.boat_id
      })) || []
    }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }
  }
})
