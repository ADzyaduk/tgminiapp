import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import {
  formatStatusNotification,
  sendAdminNotification,
  sendClientStatusNotification
} from '~/server/utils/telegram-notifications'

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
    const supabase = await serverSupabaseClient(event)

    // Обработка простых команд из меню
    if (callbackData === 'my_bookings') {
      return await handleMyBookingsCallback(message.chat.id, from, supabase, message.message_id)
    }

    if (callbackData === 'help') {
      return await handleHelpCallback(message.chat.id, message.message_id)
    }

    // Проверяем, что пользователь - администратор или менеджер для команд управления бронированиями
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

    // Проверяем права на управление этой лодкой для всех пользователей (не только с ролью manager)
    if (adminUser.role !== 'admin') {
      const { data: managerAccess } = await supabase
        .from('boat_managers')
        .select('*')
        .eq('user_id', adminUser.id)
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

    // Получаем информацию о менеджере
    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('telegram_id', from.id.toString())
      .single()

    const managerName = (managerProfile as any)?.name || 'Менеджер'

    // Отправляем подтверждение действия
    await sendTelegramResponse(
      message.chat.id,
      `${responseMessage} для клиента ${(booking as any).profile?.name || 'Нет имени'} на ${new Date((booking as any).start_time).toLocaleDateString('ru-RU')}`,
      message.message_id
    )

    // Отправляем улучшенное уведомление клиенту
    if (updatedBooking) {
      try {
        console.log('📱 Sending enhanced status notification to client from callback')
        await sendClientStatusNotification(updatedBooking, newStatus, managerName)
      } catch (notifyError) {
        console.error('Failed to send notification to client:', notifyError)
      }
    }

    // Обновляем сообщение у всех администраторов
    try {
      const notificationMessage = formatStatusNotification(updatedBooking, newStatus)

      await sendAdminNotification(notificationMessage, {
        parseMode: 'HTML',
        boatId: (updatedBooking as any).boat_id,
        bookingId: (updatedBooking as any).id
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

// Обработка callback "my_bookings"
async function handleMyBookingsCallback(chatId: number, from: any, supabase: any, messageId: number) {
  // Ищем пользователя в базе
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', from.id.toString())
    .single()

  if (!user) {
    const message = `❌ Вы не зарегистрированы в системе.

Пожалуйста, сначала зайдите в приложение через кнопку "Открыть приложение" в команде /start и создайте профиль.`

    return await sendTelegramResponse(chatId, message, messageId)
  }

  // Получаем бронирования пользователя
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, boat:boat_id(name)')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })
    .limit(5)

  if (!bookings || bookings.length === 0) {
    return await sendTelegramResponse(chatId, '📋 У вас пока нет бронирований.\n\nИспользуйте /start чтобы открыть приложение и забронировать лодку.', messageId)
  }

  let message = '📋 <b>Ваши последние бронирования:</b>\n\n'

  bookings.forEach((booking: any, index: number) => {
    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      confirmed: '✅',
      cancelled: '❌'
    }

    const emoji = statusEmoji[booking.status] || '🔔'

    const date = new Date(booking.start_time).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })

    message += `${index + 1}. ${emoji} <b>${booking.boat?.name || 'Лодка'}</b>
📅 ${date}
💰 ${booking.price} ₽
📊 Статус: ${booking.status === 'pending' ? 'Ожидает подтверждения' : booking.status === 'confirmed' ? 'Подтверждено' : 'Отменено'}

`
  })

  message += '\nИспользуйте /start для создания новых бронирований.'

  return await sendTelegramResponse(chatId, message, messageId)
}

// Обработка callback "help"
async function handleHelpCallback(chatId: number, messageId: number) {
  const message = `📖 <b>Доступные команды:</b>

/start - Главное меню и кнопка открытия приложения
/help - Показать это сообщение
/mybookings - Мои бронирования
/status - Проверить статус последнего бронирования
/boats - Список доступных лодок

🔔 <b>Уведомления:</b>
Я автоматически присылаю уведомления о:
• Подтверждении бронирования
• Отмене бронирования
• Напоминаниях перед поездкой

📱 <b>Приложение:</b>
Нажмите /start чтобы получить кнопку для открытия полного приложения.`

  return await sendTelegramResponse(chatId, message, messageId)
}

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
