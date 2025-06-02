import { defineEventHandler, getQuery } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const bookingId = query.id as string

    if (!bookingId) {
      return {
        success: false,
        error: 'booking ID is required',
        usage: 'GET /api/test/test-booking-lookup?id=BOOKING_ID'
      }
    }

    const supabase = await serverSupabaseClient(event)

    console.log('🔍 Testing booking lookup for ID:', bookingId)

    // Test 1: Basic lookup
    const { data: basicData, error: basicError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    console.log('📊 Basic lookup result:', { data: (basicData as any)?.id, error: basicError })

    // Test 2: With boat info
    const { data: withBoat, error: boatError } = await supabase
      .from('bookings')
      .select('*, boat:boat_id(*)')
      .eq('id', bookingId)
      .single()

    console.log('📊 With boat lookup result:', { data: (withBoat as any)?.id, boat: (withBoat as any)?.boat?.name, error: boatError })

    // Test 3: Just boat_id
    const { data: justBoatId, error: justBoatError } = await supabase
      .from('bookings')
      .select('boat_id')
      .eq('id', bookingId)
      .single()

    console.log('📊 Just boat_id lookup result:', { data: justBoatId, error: justBoatError })

    return {
      success: true,
      bookingId,
      tests: {
        basic: { data: basicData, error: basicError },
        withBoat: { data: withBoat, error: boatError },
        justBoatId: { data: justBoatId, error: justBoatError }
      }
    }
  } catch (error) {
    console.error('❌ Error in test:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }
  }
})
