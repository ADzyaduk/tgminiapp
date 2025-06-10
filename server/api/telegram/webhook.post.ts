import { serverSupabaseServiceRole } from '#supabase/server'

// Функция для ответа на callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return

    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || ''
      })
    })
  } catch (error) {
    console.error('Error answering callback query:', error)
  }
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Проверяем наличие callback_query (нажатие кнопки)
    if (!body.callback_query) {
      return { status: 200 }
    }

    const { callback_query } = body
    const { id: callbackQueryId, data: callbackData, message, from } = callback_query
    const chatId = message.chat.id.toString()
    const messageId = message.message_id.toString()

    // Сначала отвечаем на callback query чтобы убрать "loading"
    await answerCallbackQuery(callbackQueryId)

    // Парсим данные кнопки
    const [bookingType, action, bookingId] = callbackData.split(':')

    if (!['regular', 'group_trip'].includes(bookingType) || !['confirm', 'cancel'].includes(action)) {
      await sendTelegramMessage(chatId, '❌ Неизвестная команда')
      return { status: 400 }
    }

    const supabase = serverSupabaseServiceRole(event)

    // Проверяем права пользователя
    const userTelegramId = from.id.toString()
    const hasPermission = await checkUserPermissions(supabase, userTelegramId, bookingType, bookingId)

    if (!hasPermission) {
      await sendTelegramMessage(chatId, '❌ У вас нет прав для управления этим бронированием')
      return { status: 403 }
    }

    // Обрабатываем действие
    if (bookingType === 'regular') {
      await handleRegularBooking(supabase, action, bookingId, chatId, messageId)
    } else {
      await handleGroupTripBooking(supabase, action, bookingId, chatId, messageId)
    }

    return { status: 200 }

  } catch (error) {
    console.error('Webhook error:', error)
    return { status: 500 }
  }
})

// Проверка прав пользователя
async function checkUserPermissions(supabase: any, telegramId: string, bookingType: string, bookingId: string): Promise<boolean> {
  try {
    // Получаем пользователя по Telegram ID
    const { data: user } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('telegram_id', telegramId)
      .single()

    if (!user) return false

    // Администраторы и агенты имеют полный доступ
    if (['admin', 'agent'].includes(user.role)) {
      return true
    }

    // Для менеджеров проверяем доступ к лодке
    if (user.role === 'manager') {
      let boatId: string | null = null

      if (bookingType === 'regular') {
        const { data: booking } = await supabase
          .from('bookings')
          .select('boat_id')
          .eq('id', bookingId)
          .single()
        boatId = booking?.boat_id
      } else {
        const { data: booking } = await supabase
          .from('group_trip_bookings')
          .select('group_trip:group_trips(boat_id)')
          .eq('id', bookingId)
          .single()
        boatId = booking?.group_trip?.boat_id
      }

      // Для упрощения - менеджеры имеют доступ ко всем лодкам
      if (boatId) {
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Permission check error:', error)
    return false
  }
}

// Обработка обычного бронирования
async function handleRegularBooking(supabase: any, action: string, bookingId: string, chatId: string, messageId: string) {
  try {
    // Получаем текущее бронирование
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        profile:profiles!bookings_user_id_fkey(name, telegram_id, phone, email),
        boat:boats!bookings_boat_id_fkey(name)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      await sendTelegramMessage(chatId, '❌ Бронирование не найдено', messageId)
      return
    }

    // Проверяем текущий статус
    if (booking.status !== 'pending') {
      const statusText = booking.status === 'confirmed' ? 'уже подтверждено' : 'уже отменено'
      const emoji = booking.status === 'confirmed' ? '✅' : '❌'

      await sendTelegramMessage(
        chatId,
        `${emoji} Бронирование ${statusText}`,
        messageId
      )
      return
    }

    // Обновляем статус
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (updateError) {
      await sendTelegramMessage(chatId, '❌ Ошибка обновления статуса', messageId)
      return
    }

    // Уведомляем клиента (упрощенно)
    console.log('🔍 Booking data:', {
      user_id: booking.user_id,
      profile: booking.profile,
      telegram_id: booking.profile?.telegram_id
    })

    if (booking.profile?.telegram_id) {
      console.log(`📱 Sending notification to client: ${booking.profile.telegram_id}`)
      await notifyClient(booking.profile.telegram_id, newStatus, booking)
    } else {
      console.log('❌ No telegram_id found for client notification')
    }

    // Обновляем сообщение менеджера
    const statusText = action === 'confirm' ? 'подтверждено' : 'отменено'
    const emoji = action === 'confirm' ? '✅' : '❌'

    console.log(`🔄 Updating manager message in chat ${chatId}, message ${messageId}`)
    const updateResult = await sendTelegramMessage(
      chatId,
      `${emoji} Бронирование ${statusText}\n\nКлиент: ${booking.profile?.name || 'Не указано'}\nДата: ${new Date(booking.start_time).toLocaleDateString('ru-RU')}`,
      messageId
    )

    if (updateResult) {
      console.log('✅ Successfully updated manager message and removed buttons')
    } else {
      console.log('❌ Failed to update manager message')
    }

  } catch (error) {
    console.error('Regular booking error:', error)
    await sendTelegramMessage(chatId, '❌ Произошла ошибка', messageId)
  }
}

// Обработка группового бронирования
async function handleGroupTripBooking(supabase: any, action: string, bookingId: string, chatId: string, messageId: string) {
  try {
    // Получаем бронирование
    const { data: booking, error } = await supabase
      .from('group_trip_bookings')
      .select(`
        *,
        group_trip:group_trips(boat_id, start_date, name),
        profile:profiles!group_trip_bookings_user_id_fkey(name, telegram_id, phone, email)
      `)
      .eq('id', bookingId)
      .single()

    if (error || !booking) {
      await sendTelegramMessage(chatId, '❌ Бронирование групповой поездки не найдено', messageId)
      return
    }

    // Проверяем статус
    if (booking.status !== 'pending') {
      const statusText = booking.status === 'confirmed' ? 'уже подтверждено' : 'уже отменено'
      const emoji = booking.status === 'confirmed' ? '✅' : '❌'

      await sendTelegramMessage(
        chatId,
        `${emoji} Бронирование групповой поездки ${statusText}`,
        messageId
      )
      return
    }

    // Обновляем статус
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
    const { error: updateError } = await supabase
      .from('group_trip_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (updateError) {
      await sendTelegramMessage(chatId, '❌ Ошибка обновления статуса', messageId)
      return
    }

    // Если отменяем - возвращаем места
    if (action === 'cancel') {
      const totalTickets = booking.adult_count + booking.child_count
      // Получаем текущее количество мест и увеличиваем
      const { data: currentTrip } = await supabase
        .from('group_trips')
        .select('available_seats')
        .eq('id', booking.group_trip_id)
        .single()

      if (currentTrip) {
        await supabase
          .from('group_trips')
          .update({
            available_seats: currentTrip.available_seats + totalTickets
          })
          .eq('id', booking.group_trip_id)
      }
    }

    // Уведомляем клиента (если есть профиль)
    console.log('🔍 Group booking data:', {
      user_id: booking.user_id,
      profile: booking.profile,
      telegram_id: booking.profile?.telegram_id
    })

    if (booking.profile?.telegram_id) {
      console.log(`📱 Sending group trip notification to client: ${booking.profile.telegram_id}`)
      await notifyGroupTripClient(booking.profile.telegram_id, newStatus, booking)
    } else {
      console.log('❌ No telegram_id found for group trip client notification')
    }

    // Обновляем сообщение менеджера
    const statusText = action === 'confirm' ? 'подтверждено' : 'отменено'
    const emoji = action === 'confirm' ? '✅' : '❌'

    await sendTelegramMessage(
      chatId,
      `${emoji} Бронирование групповой поездки ${statusText}`,
      messageId
    )

  } catch (error) {
    console.error('Group trip booking error:', error)
    await sendTelegramMessage(chatId, '❌ Произошла ошибка', messageId)
  }
}

// Упрощенное уведомление клиента
async function notifyClient(telegramId: string, status: string, booking: any) {
  try {
    console.log(`📤 Attempting to notify client ${telegramId} about status ${status}`)

    const emoji = status === 'confirmed' ? '✅' : '❌'
    const statusText = status === 'confirmed' ? 'подтверждено' : 'отменено'

    const message = `${emoji} <b>Статус бронирования изменен</b>

Ваше бронирование ${statusText} менеджером.

📅 <b>Дата:</b> ${new Date(booking.start_time).toLocaleDateString('ru-RU')}
⏰ <b>Время:</b> ${new Date(booking.start_time).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})} - ${new Date(booking.end_time).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
💰 <b>Стоимость:</b> ${booking.price} ₽`

    const result = await sendTelegramMessage(telegramId, message)
    if (result) {
      console.log(`✅ Successfully notified client ${telegramId}`)
    } else {
      console.log(`❌ Failed to notify client ${telegramId}`)
    }
  } catch (error) {
    console.error(`❌ Client notification error for ${telegramId}:`, error)
  }
}

// Уведомление клиента групповой поездки
async function notifyGroupTripClient(telegramId: string, status: string, booking: any) {
  try {
    const emoji = status === 'confirmed' ? '✅' : '❌'
    const statusText = status === 'confirmed' ? 'подтверждено' : 'отменено'

    const message = `${emoji} <b>Групповая поездка ${statusText}</b>

Ваше бронирование групповой поездки ${statusText} менеджером.

👥 <b>Билеты:</b> ${booking.adult_count} взр. + ${booking.child_count} дет.
💰 <b>Стоимость:</b> ${booking.total_price} ₽`

    await sendTelegramMessage(telegramId, message)
  } catch (error) {
    console.error('Group trip client notification error:', error)
  }
}

// Отправка Telegram сообщения (упрощенная)
async function sendTelegramMessage(chatId: string, text: string, messageId?: string): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN not set')
      return false
    }

    const url = messageId
      ? `https://api.telegram.org/bot${token}/editMessageText`
      : `https://api.telegram.org/bot${token}/sendMessage`

    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    }

    // При редактировании убираем кнопки
    if (messageId) {
      body.message_id = messageId
      body.reply_markup = { inline_keyboard: [] }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Telegram API error:', errorData)
      return false
    }

    return true

  } catch (error) {
    console.error('Send message error:', error)
    return false
  }
}
