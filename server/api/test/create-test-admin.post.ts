import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const telegramId = body.telegram_id || '1396986028'
    const role = body.role || 'admin'
    const name = body.name || 'Test Admin'

    const supabase = await serverSupabaseClient(event)

    // Проверяем, существует ли уже пользователь
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single()

    if (existingUser) {
      // Обновляем роль существующего пользователя
      const { data: updatedUser, error: updateError } = await (supabase as any)
        .from('profiles')
        .update({ role, name })
        .eq('telegram_id', telegramId)
        .select('*')
        .single()

      if (updateError) {
        return {
          success: false,
          error: 'Failed to update user',
          details: updateError
        }
      }

      return {
        success: true,
        action: 'updated',
        user: updatedUser,
        message: `User with telegram_id ${telegramId} updated to role ${role}`
      }
    }

    // Создаем нового пользователя
    const { data: newUser, error: createError } = await (supabase as any)
      .from('profiles')
      .insert({
        id: crypto.randomUUID(),
        telegram_id: telegramId,
        role,
        name,
        email: `test-${telegramId}@example.com`
      })
      .select('*')
      .single()

    if (createError) {
      return {
        success: false,
        error: 'Failed to create user',
        details: createError
      }
    }

    return {
      success: true,
      action: 'created',
      user: newUser,
      message: `User with telegram_id ${telegramId} created with role ${role}`
    }
  } catch (error) {
    console.error('❌ Error creating test admin:', error)
    return {
      success: false,
      error: 'Internal server error',
      details: (error as Error).message
    }
  }
})
