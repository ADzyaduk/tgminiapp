import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import { formatStatusNotification, sendAdminNotification } from '~/server/utils/telegram-notifications'

export default defineEventHandler(async (event) => {
  try {
    // Получаем ID бронирования из параметров
    const bookingId = getRouterParam(event, 'id')
    
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
    const supabase = serverSupabaseClient(event)
    
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
    const isManager = await checkManagerAccess(supabase, user.id, currentBooking.boat_id)
    
    if (currentBooking.user_id !== user.id && !isAdmin && !isManager) {
      return {
        status: 403,
        body: { error: 'Access denied' }
      }
    }
    
    // Обновляем статус бронирования
    const { data: updatedBooking, error } = await supabase
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
        // Отправляем уведомление администраторам и менеджерам о смене статуса
        const notificationMessage = formatStatusNotification(updatedBooking, status)
        
        await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: updatedBooking.boat_id,
          bookingId: updatedBooking.id
        })
        
        // Также отправляем уведомление клиенту через Telegram, если у него есть Telegram ID
        await sendClientNotification(supabase, updatedBooking, status)
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
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
    
  // Проверяем, менеджер ли этой лодки
  if (profile?.role === 'manager') {
    const { data: boatManager, error } = await supabase
      .from('boat_managers')
      .select('*')
      .eq('profile_id', userId)
      .eq('boat_id', boatId)
      .single()
      
    return !!boatManager
  }
  
  return false
}

// Отправка уведомления клиенту, если у него настроен Telegram
async function sendClientNotification(supabase: any, booking: any, status: string): Promise<boolean> {
  // Если у клиента нет Telegram ID, не отправляем
  if (!booking.profile?.telegram_id) return false
  
  // Сообщения для разных статусов
  const statusMessages: Record<string, string> = {
    confirmed: `✅ Ваше бронирование лодки "${booking.boat.name}" на ${new Date(booking.start_time).toLocaleDateString('ru-RU')} подтверждено!`,
    cancelled: `❌ Ваше бронирование лодки "${booking.boat.name}" на ${new Date(booking.start_time).toLocaleDateString('ru-RU')} было отменено.`,
    pending: `⏳ Ваше бронирование лодки "${booking.boat.name}" ожидает подтверждения.`
  }
  
  const message = statusMessages[status] || 'Статус вашего бронирования изменен'
  
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return false
    
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: booking.profile.telegram_id,
        text: message,
        parse_mode: 'HTML'
      })
    })
    
    return response.ok
  } catch (error) {
    console.error('Error sending notification to client:', error)
    return false
  }
} 