import { defineEventHandler, readBody, getRouterParam, setResponseStatus } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // Получаем ID бронирования из параметров
    const bookingId = getRouterParam(event, 'id')

    if (!bookingId) {
      setResponseStatus(event, 400)
      return { error: 'Booking ID is required' }
    }

    // Получаем новый статус из запроса
    const { status } = await readBody(event)

    // Проверяем валидность статуса
    const validStatuses = ['pending', 'confirmed', 'cancelled']
    if (!validStatuses.includes(status)) {
      setResponseStatus(event, 400)
      return { error: 'Invalid status. Valid values: pending, confirmed, cancelled' }
    }

    // Проверяем авторизацию пользователя
    const user = await serverSupabaseUser(event)

    if (!user) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }

    // Подключаемся к Supabase
    const supabase = await serverSupabaseClient(event)

    // Получаем текущее бронирование
    const { data: currentBooking, error: fetchError } = await (supabase as any)
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (fetchError) {
      setResponseStatus(event, 500)
      return { error: 'Error fetching booking', details: fetchError }
    }

    if (!currentBooking) {
      setResponseStatus(event, 404)
      return { error: 'Booking not found' }
    }

    // Проверяем права доступа (владелец бронирования, администратор или менеджер лодки)
    const isAdmin = await checkAdminAccess(supabase, user.id)
    const isManager = await checkManagerAccess(supabase, user.id, currentBooking.boat_id)

    if (currentBooking.user_id !== user.id && !isAdmin && !isManager) {
      setResponseStatus(event, 403)
      return { error: 'Access denied' }
    }

    // Обновляем статус бронирования
    const { data: updatedBooking, error: updateError } = await (supabase as any)
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating booking status:', updateError)
      setResponseStatus(event, 500)
      return { error: 'Failed to update booking status', details: updateError }
    }

    // Получаем дополнительные данные для уведомлений
    if (updatedBooking) {
      try {
        // Получаем данные профиля клиента
        let clientProfile = null
        if (updatedBooking.user_id) {
          const { data: profile } = await (supabase as any)
            .from('profiles')
            .select('*')
            .eq('id', updatedBooking.user_id)
            .single()
          clientProfile = profile
        }

        // Получаем данные лодки
        const { data: boat } = await (supabase as any)
          .from('boats')
          .select('*')
          .eq('id', updatedBooking.boat_id)
          .single()

        // Получаем информацию о менеджере, который изменил статус
        const { data: managerProfile } = await (supabase as any)
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single()

        const managerName = managerProfile?.name || 'Менеджер'

        // Создаем объект бронирования с полными данными для уведомлений
        const bookingWithDetails = {
          ...updatedBooking,
          profile: clientProfile,
          boat: boat
        }

        // Отправляем уведомление клиенту (если есть telegram_id)
        if (clientProfile?.telegram_id) {
          const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications')
          await sendClientStatusNotification(bookingWithDetails, status, managerName)
        }

        // Отправляем уведомление администраторам и менеджерам
        const { formatStatusNotification, sendAdminNotification } = await import('~/server/utils/telegram-notifications')
        const notificationMessage = formatStatusNotification(bookingWithDetails, status)

        await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: updatedBooking.boat_id,
          bookingId: updatedBooking.id,
          event
        })

      } catch (notifyError) {
        console.error('Failed to send notifications:', notifyError)
        // Не падаем, если уведомления не отправились
      }
    }

    // Возвращаем успешный результат
    setResponseStatus(event, 200)
    return {
      success: true,
      data: updatedBooking,
      message: 'Booking status updated successfully'
    }

  } catch (error) {
    console.error('Error in updating booking status:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error', details: error }
  }
})

// Проверка администраторских прав
async function checkAdminAccess(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    return data?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin access:', error)
    return false
  }
}

// Проверка прав менеджера конкретной лодки
async function checkManagerAccess(supabase: any, userId: string, boatId: string): Promise<boolean> {
  try {
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
  } catch (error) {
    console.error('Error checking manager access:', error)
    return false
  }
}
