import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

/**
 * API для связки существующего аккаунта с Telegram ID
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { telegram_id } = body

    if (!telegram_id) {
      return { status: 400, body: { error: 'Telegram ID required' } }
    }

    // Получаем текущего авторизованного пользователя
    const user = await serverSupabaseUser(event)
    if (!user) {
      return { status: 401, body: { error: 'User not authenticated' } }
    }

    const supabase = await serverSupabaseClient(event)

    // Проверяем что этот Telegram ID не занят другим пользователем
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('telegram_id', telegram_id)
      .neq('id', user.id)
      .single()

    if (existingUser) {
      return {
        status: 409,
        body: {
          error: 'Этот Telegram ID уже привязан к другому аккаунту',
          existing_email: existingUser.email
        }
      }
    }

    // Обновляем профиль пользователя, добавляя Telegram ID
    const { error } = await supabase
      .from('profiles')
      .update({
        telegram_id: telegram_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error linking telegram account:', error)
      return { status: 500, body: { error: 'Failed to link telegram account' } }
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Telegram аккаунт успешно привязан',
        telegram_id: telegram_id
      }
    }
  } catch (error) {
    console.error('Error in telegram link:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})
