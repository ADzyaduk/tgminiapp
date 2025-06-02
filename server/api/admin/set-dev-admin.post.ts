import { defineEventHandler, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()

    // Только в development режиме
    if (!config.public.isTelegramDevMode) {
      setResponseStatus(event, 403)
      return { success: false, error: 'Only available in development mode' }
    }

    const supabase = serverSupabaseServiceRole(event)

    // Ищем Dev пользователя с telegram_id = 123456789
    const { data: devUser } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('telegram_id', '123456789')
      .single()

    if (!devUser) {
      setResponseStatus(event, 404)
      return { success: false, error: 'Dev user not found. Please authenticate first.' }
    }

    // Устанавливаем роль админа
    const { data: updatedUser, error } = await (supabase as any)
      .from('profiles')
      .update({ role: 'admin' })
      .eq('telegram_id', '123456789')
      .select('*')
      .single()

    if (error) {
      console.error('Error setting admin role:', error)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to set admin role' }
    }

    console.log('✅ Dev user is now admin:', updatedUser?.telegram_id)

    return {
      success: true,
      message: 'Dev user role updated to admin',
      user: updatedUser
    }

  } catch (error: any) {
    console.error('Set dev admin error:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Internal server error' }
  }
})
