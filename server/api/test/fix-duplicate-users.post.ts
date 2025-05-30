import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    // Находим пользователя-дубликат из Telegram
    const { data: telegramDuplicate } = await supabase
      .from('profiles')
      .select('id, email, telegram_id')
      .eq('email', 'KaZaNoVuS@telegram.tmp')
      .single()

    // Находим основного пользователя
    const { data: mainUser } = await supabase
      .from('profiles')
      .select('id, email, telegram_id')
      .eq('email', 'rdr-kazanova@mail.ru')
      .single()

    if (!telegramDuplicate || !mainUser) {
      return {
        status: 404,
        body: { error: 'Users not found' }
      }
    }

    // Обновляем основного пользователя Telegram ID если его нет
    if (!mainUser.telegram_id && telegramDuplicate.telegram_id) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ telegram_id: telegramDuplicate.telegram_id })
        .eq('id', mainUser.id)

      if (updateError) {
        return {
          status: 500,
          body: { error: 'Failed to update main user', details: updateError }
        }
      }
    }

    // Удаляем дублирующего пользователя
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', telegramDuplicate.id)

    if (deleteError) {
      return {
        status: 500,
        body: { error: 'Failed to delete duplicate', details: deleteError }
      }
    }

    return {
      status: 200,
      body: {
        success: true,
        message: 'Duplicate user fixed',
        main_user: mainUser.email,
        telegram_id: telegramDuplicate.telegram_id,
        deleted_user: telegramDuplicate.email
      }
    }
  } catch (error: any) {
    console.error('Fix duplicate users error:', error)
    return {
      status: 500,
      error: 'Failed to fix duplicates',
      details: error?.message || 'Unknown error'
    }
  }
})
