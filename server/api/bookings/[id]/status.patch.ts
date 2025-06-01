import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import {
  formatStatusNotification,
  sendAdminNotification,
  sendClientStatusNotification
} from '~/server/utils/telegram-notifications'

export default defineEventHandler(async (event) => {
  try {
    // Получаем ID бронирования из параметров
    const bookingId = getRouterParam(event, 'id')

    if (!bookingId) {
      return {
        status: 400,
        body: { error: 'Booking ID is required' }
      }
    }

    // Получаем новый статус из запроса
    const { status } = await readBody(event)

    // Проверяем валидность статуса
    const validStatuses = ['pending', 'confirmed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return {
        status: 400,
        body: { error: 'Invalid status. Valid values: pending, confirmed, cancelled' }
      }
    }

    // Проверяем авторизацию пользователя
    const user = await serverSupabaseUser(event)
    if (!user) {
      return {
        status: 401,
        body: { error: 'Unauthorized' }
      }
    }

    // Подключаемся к Supabase
    const supabase = await serverSupabaseClient(event)

    // Получаем текущее бронирование
    const { data: currentBooking } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .eq('id', bookingId)
      .single()

    if (!currentBooking) {
      return {
        status: 404,
        body: { error: 'Booking not found' }
      }
    }

    // Проверяем права доступа (владелец бронирования, администратор или менеджер лодки)
    const isAdmin = await checkAdminAccess(supabase, user.id)
    const isManager = await checkManagerAccess(supabase, user.id, (currentBooking as any).boat_id)

    if ((currentBooking as any).user_id !== user.id && !isAdmin && !isManager) {
      return {
        status: 403,
        body: { error: 'Access denied' }
      }
    }

    // Обновляем статус бронирования
    const { data: updatedBooking, error } = await (supabase as any)
      .from('bookings')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .single()

    if (error) {
      console.error('Error updating booking status:', error)
      return {
        status: 500,
        body: { error: 'Failed to update booking status' }
      }
    }

    // Отправляем уведомления
    if (updatedBooking) {
      try {
        // Получаем информацию о менеджере, который изменил статус
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single()

        const managerName = (managerProfile as any)?.name || 'Менеджер'

        // Отправляем улучшенное уведомление клиенту
        console.log('📱 Sending enhanced status notification to client')
        await sendClientStatusNotification(updatedBooking, status, managerName)

        // Отправляем уведомление администраторам и менеджерам о смене статуса
        const notificationMessage = formatStatusNotification(updatedBooking, status)

        await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: (updatedBooking as any).boat_id,
          bookingId: (updatedBooking as any).id
        })

      } catch (notifyError) {
        console.error('Failed to send notifications:', notifyError)
      }
    }

    return {
      status: 200,
      body: updatedBooking
    }
  } catch (error) {
    console.error('Error in updating booking status:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
})

// Проверка администраторских прав
async function checkAdminAccess(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return data?.role === 'admin'
}

// Проверка прав менеджера конкретной лодки
async function checkManagerAccess(supabase: any, userId: string, boatId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  // Если админ - всегда разрешаем
  if (profile?.role === 'admin') return true

  // Если пользователь с ролью manager - разрешаем все
  if (profile?.role === 'manager') return true

  // Для всех остальных ролей проверяем, назначен ли пользователь менеджером этой лодки
  const { data: boatManager, error } = await supabase
    .from('boat_managers')
    .select('*')
    .eq('user_id', userId)
    .eq('boat_id', boatId)
    .single()

  return !!boatManager
}
