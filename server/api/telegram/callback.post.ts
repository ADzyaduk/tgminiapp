import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import { formatStatusNotification, sendAdminNotification } from '~/server/utils/telegram-notifications'

// Обработчик callback-запросов от Telegram Bot
export default defineEventHandler(async (event) => {
  try {
    // Получаем данные запроса от Telegram
    const body = await readBody(event)
    
    // Проверка наличия callback_query
    if (!body || !body.callback_query) {
      return { status: 400, body: { error: 'Invalid request. Expected callback_query.' } }
    }
    
    const { callback_query } = body
    const { data: callbackData, message, from } = callback_query
    
    // Проверка наличия данных
    if (!callbackData || !from || !message) {
      return { status: 400, body: { error: 'Invalid callback data' } }
    }
    
    // Подключение к Supabase
    const supabase = serverSupabaseClient(event)
    
    // Проверяем, что пользователь - администратор или менеджер
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('telegram_id', from.id.toString())
      .in('role', ['admin', 'manager'])
      .single()
      
    if (!adminUser) {
      // Отправляем сообщение о том, что у пользователя нет прав
      await sendTelegramResponse(
        message.chat.id,
        '❌ У вас нет прав для выполнения этого действия',
        message.message_id
      )
      return { status: 403, body: { error: 'Access denied' } }
    }
    
    // Разбираем callbackData формата action:bookingId
    const [action, bookingId] = callbackData.split(':')
    
    if (!action || !bookingId) {
      await sendTelegramResponse(
        message.chat.id,
        '❌ Некорректные данные запроса',
        message.message_id
      )
      return { status: 400, body: { error: 'Invalid callback data format' } }
    }
    
    // Получаем информацию о бронировании
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .eq('id', bookingId)
      .single()
      
    if (!booking) {
      await sendTelegramResponse(
        message.chat.id,
        '❌ Бронирование не найдено или было удалено',
        message.message_id
      )
      return { status: 404, body: { error: 'Booking not found' } }
    }
    
    // Если пользователь - менеджер, проверяем права на эту лодку
    if (adminUser.role === 'manager') {
      const { data: managerAccess } = await supabase
        .from('boat_managers')
        .select('*')
        .eq('profile_id', adminUser.id)
        .eq('boat_id', booking.boat_id)
        .single()
        
      if (!managerAccess) {
        await sendTelegramResponse(
          message.chat.id,
          '❌ У вас нет прав на управление этой лодкой',
          message.message_id
        )
        return { status: 403, body: { error: 'Access denied for this boat' } }
      }
    }
    
    // Выполняем действие в зависимости от команды
    let newStatus = ''
    let responseMessage = ''
    
    if (action === 'confirm_booking') {
      newStatus = 'confirmed'
      responseMessage = `✅ Бронирование подтверждено`
    } else if (action === 'cancel_booking') {
      newStatus = 'cancelled'
      responseMessage = `❌ Бронирование отменено`
    } else {
      await sendTelegramResponse(
        message.chat.id,
        '❓ Неизвестное действие',
        message.message_id
      )
      return { status: 400, body: { error: 'Unknown action' } }
    }
    
    // Обновляем статус бронирования
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
        updated_by: adminUser.id
      })
      .eq('id', bookingId)
      
    if (updateError) {
      await sendTelegramResponse(
        message.chat.id,
        '❌ Ошибка при обновлении бронирования',
        message.message_id
      )
      return { status: 500, body: { error: 'Failed to update booking' } }
    }
    
    // Получаем обновленные данные бронирования для уведомлений
    const { data: updatedBooking } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .eq('id', bookingId)
      .single()
      
    // Отправляем подтверждение действия
    await sendTelegramResponse(
      message.chat.id,
      `${responseMessage} для клиента ${booking.profile.name || 'Нет имени'} на ${new Date(booking.start_time).toLocaleDateString('ru-RU')}`,
      message.message_id
    )
    
    // Отправляем уведомление клиенту, если у него есть Telegram ID
    if (updatedBooking.profile?.telegram_id) {
      try {
        // Сообщения для разных статусов
        const statusMessages: Record<string, string> = {
          confirmed: `✅ Ваше бронирование лодки "${updatedBooking.boat.name}" на ${new Date(updatedBooking.start_time).toLocaleDateString('ru-RU')} подтверждено!`,
          cancelled: `❌ Ваше бронирование лодки "${updatedBooking.boat.name}" на ${new Date(updatedBooking.start_time).toLocaleDateString('ru-RU')} было отменено.`
        }
        
        const message = statusMessages[newStatus] || 'Статус вашего бронирования изменен'
        
        const token = process.env.TELEGRAM_BOT_TOKEN
        if (token) {
          const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`
          
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: updatedBooking.profile.telegram_id,
              text: message,
              parse_mode: 'HTML'
            })
          })
        }
      } catch (notifyError) {
        console.error('Failed to send notification to client:', notifyError)
      }
    }
    
    // Обновляем сообщение у всех администраторов
    try {
      const notificationMessage = formatStatusNotification(updatedBooking, newStatus)
      
      await sendAdminNotification(notificationMessage, {
        parseMode: 'HTML',
        boatId: updatedBooking.boat_id,
        silent: true // Без звука, чтобы не спамить
      })
    } catch (notifyError) {
      console.error('Failed to update admin notifications:', notifyError)
    }
    
    return { status: 200, body: { success: true } }
  } catch (error) {
    console.error('Error in telegram callback handler:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})

// Отправка ответа в Telegram
async function sendTelegramResponse(chatId: number, text: string, messageId?: number): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return false
    
    // Если указан messageId, редактируем сообщение, иначе отправляем новое
    const method = messageId ? 'editMessageText' : 'sendMessage'
    const apiUrl = `https://api.telegram.org/bot${token}/${method}`
    
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    }
    
    // Для редактирования сообщения необходим его ID
    if (messageId) {
      payload.message_id = messageId
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    return response.ok
  } catch (error) {
    console.error('Error sending telegram response:', error)
    return false
  }
} 