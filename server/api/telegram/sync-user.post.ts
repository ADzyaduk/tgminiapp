import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

/**
 * API для синхронизации Telegram ID пользователя с профилем
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { telegram_user } = body

    if (!telegram_user || !telegram_user.id) {
      return { status: 400, body: { error: 'Telegram user data required' } }
    }

    // Получаем текущего авторизованного пользователя
    const user = await serverSupabaseUser(event)
    if (!user) {
      return { status: 401, body: { error: 'User not authenticated' } }
    }

    const supabase = await serverSupabaseClient(event)

    // Обновляем профиль пользователя, добавляя Telegram ID
    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_id: telegram_user.id.toString(),
        telegram_username: telegram_user.username || null,
        telegram_first_name: telegram_user.first_name || null,
        telegram_last_name: telegram_user.last_name || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error updating profile with telegram data:', error)
      return { status: 500, body: { error: 'Failed to sync telegram data' } }
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Telegram data synced successfully',
        telegram_id: telegram_user.id.toString()
      }
    }
  } catch (error) {
    console.error('Error in telegram sync:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})
