import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const bookingId = body.booking_id || '65'
    const telegramId = body.telegram_id || '1396986028'
    const action = body.action || 'confirm'

    console.log('🧪 Debug webhook test started:', { bookingId, telegramId, action })

    const supabase = serverSupabaseServiceRole(event)

    // Step 1: Check user exists and has admin role
    console.log('Step 1: Checking user...')
    const { data: adminUser, error: userError } = await supabase
      .from('profiles')
      .select('id, role, name')
      .eq('telegram_id', telegramId)
      .in('role', ['admin', 'manager'])
      .single()

    console.log('👤 User check result:', { user: adminUser, error: userError })

    if (!adminUser) {
      return {
        success: false,
        step: 1,
        error: 'User not found or no admin/manager role',
        details: userError
      }
    }

    // Step 2: Check booking exists
    console.log('Step 2: Checking booking...')
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('boat_id, id, guest_name, start_time, status')
      .eq('id', bookingId)
      .single()

    console.log('📊 Booking check result:', { booking, error: bookingError })

    if (!booking) {
      return {
        success: false,
        step: 2,
        error: 'Booking not found',
        details: bookingError
      }
    }

    // Step 3: Check boat manager access (only if not admin)
    console.log('Step 3: Checking boat access...')
    let hasAccess = (adminUser as any).role === 'admin'

    if (!hasAccess) {
      const { data: managerAccess } = await supabase
        .from('boat_managers')
        .select('*')
        .eq('user_id', (adminUser as any).id)
        .eq('boat_id', (booking as any).boat_id)
        .single()

      hasAccess = !!managerAccess
      console.log('🔑 Manager access check:', { access: managerAccess, hasAccess })
    } else {
      console.log('🔑 User is admin, has full access')
    }

    if (!hasAccess) {
      return {
        success: false,
        step: 3,
        error: 'No access to this boat'
      }
    }

    // Step 4: Update booking status
    console.log('Step 4: Updating booking status...')
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'

    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('bookings')
      .update({
        status: newStatus
      })
      .eq('id', bookingId)
      .select('*')

    console.log('⚡ Update result:', { booking: updatedBooking, error: updateError })

    if (updateError) {
      return {
        success: false,
        step: 4,
        error: 'Failed to update booking',
        details: updateError
      }
    }

    return {
      success: true,
      message: `Booking ${bookingId} ${action}ed successfully`,
      booking: updatedBooking,
      user: adminUser
    }
  } catch (error) {
    console.error('❌ Debug test error:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }
  }
})
