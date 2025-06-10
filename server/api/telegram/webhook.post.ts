import { serverSupabaseServiceRole } from '#supabase/server'

// Функция для ответа на callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error('❌ TELEGRAM_BOT_TOKEN not set for answerCallbackQuery')
      return false
    }

    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`

    console.log(`📞 Calling answerCallbackQuery for callback ID: ${callbackQueryId}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
        show_alert: false
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
      console.error('❌ answerCallbackQuery failed:', errorData)
      return false
    }

    const result = await response.json()
    console.log('✅ answerCallbackQuery successful:', result)
    return true

  } catch (error) {
    console.error('❌ Error in answerCallbackQuery:', error)
    return false
  }
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    console.log('🔄 Received webhook update:', JSON.stringify(body, null, 2))

    // Проверяем наличие callback_query (нажатие кнопки)
    if (!body.callback_query) {
      console.log('ℹ️ No callback_query in request, ignoring')
      return { status: 200 }
    }

    const { callback_query } = body
    const { id: callbackQueryId, data: callbackData, message, from } = callback_query
    const chatId = message.chat.id.toString()
    const messageId = message.message_id.toString()

    console.log(`🔘 Button pressed:`, {
      callbackQueryId,
      callbackData,
      chatId,
      messageId,
      fromUser: from.id
    })

    console.log('📱 Full callback query:', JSON.stringify(callback_query, null, 2))
    console.log('💬 Message content:', message.text)
    console.log('🎯 Raw callback data:', callbackData)

    // Сначала отвечаем на callback query чтобы убрать "loading"
    const answerResult = await answerCallbackQuery(callbackQueryId, '🔄 Обрабатываем...')
    console.log(`📞 answerCallbackQuery result: ${answerResult}`)

    // Парсим данные кнопки
    const [bookingType, action, bookingId] = callbackData.split(':')

    console.log(`📝 Parsed callback data:`, { bookingType, action, bookingId })

    if (!['regular', 'group_trip'].includes(bookingType) || !['confirm', 'cancel'].includes(action)) {
      console.error('❌ Invalid callback data format:', { bookingType, action, bookingId })
      await sendTelegramMessage(chatId, '❌ Неизвестная команда')
      return { status: 400 }
    }

    const supabase = serverSupabaseServiceRole(event)

    // Проверяем права пользователя
    const userTelegramId = from.id.toString()
    console.log(`🔐 Checking permissions for user ${userTelegramId}`)
    const hasPermission = await checkUserPermissions(supabase, userTelegramId, bookingType, bookingId)

    if (!hasPermission) {
      console.log(`❌ User ${userTelegramId} has no permission for ${bookingType} booking ${bookingId}`)
      await sendTelegramMessage(chatId, '❌ У вас нет прав для управления этим бронированием')
      return { status: 403 }
    }

    console.log(`✅ User ${userTelegramId} has permission, processing ${action} for ${bookingType} booking ${bookingId}`)

    // Обрабатываем действие
    if (bookingType === 'regular') {
      await handleRegularBooking(supabase, action, bookingId, chatId, messageId)
    } else {
      await handleGroupTripBooking(supabase, action, bookingId, chatId, messageId)
    }

    return { status: 200 }

  } catch (error) {
    console.error('❌ Webhook error:', error)
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
    console.log(`🔍 Processing regular booking: ${bookingId}, action: ${action}`)

    // Получаем текущее бронирование (без сложных foreign key)
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single()

    if (error) {
      console.error('❌ Error fetching booking:', error)
      await sendTelegramMessage(chatId, '❌ Ошибка при получении бронирования', messageId)
      return
    }

    if (!booking) {
      console.log('❌ Booking not found')
      await sendTelegramMessage(chatId, '❌ Бронирование не найдено', messageId)
      return
    }

    console.log('📋 Booking found:', booking)

    // Получаем данные профиля отдельно
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, telegram_id, phone, email')
      .eq('id', booking.user_id)
      .single()

    // Получаем данные лодки отдельно
    const { data: boat } = await supabase
      .from('boats')
      .select('name')
      .eq('id', booking.boat_id)
      .single()

    console.log('👤 Profile data:', profile)
    console.log('🚤 Boat data:', boat)

    // Создаем полный объект
    const fullBooking = {
      ...booking,
      profile: profile || { name: 'Не указано', telegram_id: null },
      boat: boat || { name: 'Не указано' }
    }

    // Проверяем текущий статус
    if (fullBooking.status !== 'pending') {
      const statusText = fullBooking.status === 'confirmed' ? 'уже подтверждено' : 'уже отменено'
      const emoji = fullBooking.status === 'confirmed' ? '✅' : '❌'

      console.log(`⚠️ Booking already processed: ${fullBooking.status}`)
      await sendTelegramMessage(
        chatId,
        `${emoji} Бронирование ${statusText}`,
        messageId
      )
      return
    }

    // Обновляем статус
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
    console.log(`🔄 Updating booking status from ${fullBooking.status} to ${newStatus}`)

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (updateError) {
      console.error('❌ Status update error:', updateError)
      await sendTelegramMessage(chatId, '❌ Ошибка обновления статуса', messageId)
      return
    }

    console.log('✅ Status updated successfully')

    // Сначала обновляем сообщение менеджера (убираем кнопки)
    const statusText = action === 'confirm' ? 'подтверждено' : 'отменено'
    const emoji = action === 'confirm' ? '✅' : '❌'

    const updatedMessage = `${emoji} <b>Бронирование ${statusText}</b>

👤 <b>Клиент:</b> ${fullBooking.profile?.name || 'Не указано'}
📅 <b>Дата:</b> ${new Date(fullBooking.start_time).toLocaleDateString('ru-RU')}
⏰ <b>Время:</b> ${new Date(fullBooking.start_time).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})} - ${new Date(fullBooking.end_time).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}
🚤 <b>Лодка:</b> ${fullBooking.boat?.name || 'Не указано'}
💰 <b>Стоимость:</b> ${fullBooking.price} ₽`

    console.log(`🔄 Updating manager message in chat ${chatId}, message ${messageId}`)
    console.log(`📝 New message content: ${updatedMessage}`)

    const updateResult = await sendTelegramMessage(chatId, updatedMessage, messageId)

    if (updateResult) {
      console.log('✅ Successfully updated manager message and removed buttons')
    } else {
      console.log('❌ Failed to update manager message')
    }

    // Затем пытаемся уведомить клиента (не критично если не получится)
    console.log('🔍 Booking data:', {
      user_id: fullBooking.user_id,
      profile: fullBooking.profile,
      telegram_id: fullBooking.profile?.telegram_id
    })

    if (fullBooking.profile?.telegram_id) {
      console.log(`📱 Sending notification to client: ${fullBooking.profile.telegram_id}`)
      await notifyClient(fullBooking.profile.telegram_id, newStatus, fullBooking)
    } else {
      console.log('❌ No telegram_id found for client notification')
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

        // Сначала обновляем сообщение менеджера
    const statusText = action === 'confirm' ? 'подтверждено' : 'отменено'
    const emoji = action === 'confirm' ? '✅' : '❌'

    const updatedMessage = `${emoji} <b>Групповая поездка ${statusText}</b>

👤 <b>Клиент:</b> ${booking.profile?.name || 'Не указано'}
📅 <b>Дата:</b> ${booking.group_trip?.start_date ? new Date(booking.group_trip.start_date).toLocaleDateString('ru-RU') : 'Не указано'}
🎯 <b>Поездка:</b> ${booking.group_trip?.name || 'Не указано'}
👥 <b>Билеты:</b> ${booking.adult_count} взр. + ${booking.child_count} дет.
💰 <b>Стоимость:</b> ${booking.total_price} ₽`

    console.log(`🔄 Updating group trip manager message in chat ${chatId}, message ${messageId}`)
    console.log(`📝 New message content: ${updatedMessage}`)

    const updateResult = await sendTelegramMessage(chatId, updatedMessage, messageId)

    if (updateResult) {
      console.log('✅ Successfully updated group trip manager message and removed buttons')
    } else {
      console.log('❌ Failed to update group trip manager message')
    }

    // Затем пытаемся уведомить клиента
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
      console.error('❌ TELEGRAM_BOT_TOKEN not set')
      return false
    }

    const isEdit = !!messageId
    const url = isEdit
      ? `https://api.telegram.org/bot${token}/editMessageText`
      : `https://api.telegram.org/bot${token}/sendMessage`

    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    }

    // При редактировании убираем кнопки
    if (isEdit) {
      body.message_id = parseInt(messageId)
      body.reply_markup = { inline_keyboard: [] }
      console.log(`✏️ Editing message ${messageId} in chat ${chatId} and removing buttons`)
    } else {
      console.log(`📨 Sending new message to chat ${chatId}`)
    }

    console.log(`🔗 URL: ${url}`)
    console.log(`📝 Body:`, JSON.stringify(body, null, 2))

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const responseText = await response.text()
    console.log(`📊 Response status: ${response.status}`)
    console.log(`📊 Response text: ${responseText}`)

    if (!response.ok) {
      try {
        const errorData = JSON.parse(responseText)
        console.error('❌ Telegram API error:', errorData)

        // Проверяем специфичные ошибки
        if (errorData.error_code === 400 && errorData.description?.includes('message is not modified')) {
          console.log('ℹ️ Message content is the same, this is expected when just removing buttons')
          return true
        }
      } catch (parseError) {
        console.error('❌ Failed to parse error response:', responseText)
      }
      return false
    }

    try {
      const result = JSON.parse(responseText)
      console.log('✅ Telegram API success:', result)
    } catch (parseError) {
      console.log('✅ Telegram API success (raw response):', responseText)
    }

    return true

  } catch (error) {
    console.error('❌ Send message error:', error)
    return false
  }
}
