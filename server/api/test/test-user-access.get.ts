import { defineEventHandler, getQuery } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const telegramId = query.telegram_id as string || '1396986028'

    const supabase = await serverSupabaseClient(event)

    console.log('🔍 Testing user access for telegram_id:', telegramId)

    // Test 1: Find user by telegram_id
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single()

    console.log('👤 User lookup result:', { user: (user as any)?.name, role: (user as any)?.role, error: userError })

    // Test 2: Check admin/manager access
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('id, role, name')
      .eq('telegram_id', telegramId)
      .in('role', ['admin', 'manager'])
      .single()

    console.log('🔑 Admin/manager access result:', { user: adminUser, error: adminError })

    // Test 3: Check boat managers for specific boat
    const boatId = "874f57d8-82fa-4b88-96b8-cc5e8e1066d7" // Kiss boat
    let managerAccess = null
    let managerError = null

    if (user) {
      const { data, error } = await supabase
        .from('boat_managers')
        .select('*')
        .eq('user_id', (user as any).id)
        .eq('boat_id', boatId)
        .single()

      managerAccess = data
      managerError = error
    }

    console.log('🚤 Boat manager access result:', { access: managerAccess, error: managerError })

    return {
      success: true,
      telegramId,
      results: {
        userExists: !!user,
        hasAdminManagerRole: !!adminUser,
        hasBoatAccess: !!managerAccess,
        userDetails: user,
        adminDetails: adminUser,
        managerDetails: managerAccess,
        errors: {
          userError,
          adminError,
          managerError
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in user access test:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }
  }
})
