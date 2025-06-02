import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Обрабатываем callback queries (нажатия кнопок)
    if (body.callback_query) {
      const callbackQuery = body.callback_query
      const callbackData = callbackQuery.data
      const messageId = callbackQuery.message.message_id
      const chatId = callbackQuery.message.chat.id
      const from = callbackQuery.from

      console.log('📱 Received callback query:', callbackData)

      // Парсим callback_data: confirm_regular_123 или cancel_group_trip_456
      const [action, bookingType, bookingId] = callbackData.split('_')

      if (!action || !bookingType || !bookingId) {
        console.error('Invalid callback data format:', callbackData)
        return { ok: true }
      }

      const supabase = await serverSupabaseClient(event)

      // Проверяем, что пользователь - администратор или менеджер для команд управления бронированиями
      const { data: adminUser } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('telegram_id', from.id.toString())
        .in('role', ['admin', 'manager'])
        .single()

      if (!adminUser) {
        // Отправляем сообщение о том, что у пользователя нет прав
        await sendTelegramMessage(
          chatId,
          '❌ У вас нет прав для выполнения этого действия',
          messageId
        )
        return { ok: true }
      }

      // Получаем информацию о бронировании для проверки прав на лодку
      let booking: any = null
      if (bookingType === 'regular') {
        const { data } = await supabase
          .from('bookings')
          .select('boat_id')
          .eq('id', bookingId)
          .single()
        booking = data
      } else if (bookingType === 'group_trip') {
        const { data } = await supabase
          .from('group_trip_bookings')
          .select('group_trip:group_trips(boat_id)')
          .eq('id', bookingId)
          .single()
        booking = data ? { boat_id: (data as any).group_trip?.boat_id } : null
      }

      if (!booking) {
        await sendTelegramMessage(chatId, '❌ Бронирование не найдено', messageId)
        return { ok: true }
      }

      // Проверяем права на управление этой лодкой для всех пользователей (не только с ролью manager)
      if ((adminUser as any).role !== 'admin') {
        const { data: managerAccess } = await supabase
          .from('boat_managers')
          .select('*')
          .eq('user_id', (adminUser as any).id)
          .eq('boat_id', booking.boat_id)
          .single()

        if (!managerAccess) {
          await sendTelegramMessage(
            chatId,
            '❌ У вас нет прав на управление этой лодкой',
            messageId
          )
          return { ok: true }
        }
      }

      if (bookingType === 'regular') {
        await handleRegularBookingAction(supabase, action, bookingId, chatId, messageId, (adminUser as any).id)
      } else if (bookingType === 'group_trip') {
        await handleGroupTripBookingAction(supabase, action, bookingId, chatId, messageId)
      }
    }

    return { ok: true }
  } catch (error) {
    console.error('Error processing Telegram webhook:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error' }
  }
})

// Обработка действий для обычных бронирований
async function handleRegularBookingAction(
  supabase: any,
  action: string,
  bookingId: string,
  chatId: string,
  messageId: string,
  updatedBy: string
) {
  try {
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'

    // Получаем текущее бронирование
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      await sendTelegramMessage(chatId, '❌ Бронирование не найдено', messageId)
      return
    }

    // Обновляем статус
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      })
      .eq('id', bookingId)

    if (updateError) {
      await sendTelegramMessage(chatId, '❌ Ошибка обновления статуса', messageId)
      return
    }

    // Получаем полные данные для уведомления клиенту
    const { data: fullBooking } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .eq('id', bookingId)
      .single()

    // Отправляем уведомление клиенту
    if (fullBooking?.profile?.telegram_id) {
      const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications')
      await sendClientStatusNotification(fullBooking, newStatus, 'Менеджер')
    }

    // Обновляем сообщение в Telegram
    const statusText = action === 'confirm' ? 'подтверждено' : 'отменено'
    const emoji = action === 'confirm' ? '✅' : '❌'
    await sendTelegramMessage(
      chatId,
      `${emoji} Бронирование ${statusText} для клиента ${booking.profile?.name || 'Нет имени'} на ${new Date(booking.start_time).toLocaleDateString('ru-RU')}`,
      messageId
    )

  } catch (error) {
    console.error('Error handling regular booking action:', error)
    await sendTelegramMessage(chatId, '❌ Произошла ошибка', messageId)
  }
}

// Обработка действий для групповых поездок
async function handleGroupTripBookingAction(
  supabase: any,
  action: string,
  bookingId: string,
  chatId: string,
  messageId: string
) {
  try {
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'

    // Получаем текущее бронирование групповой поездки
    const { data: booking, error: fetchError } = await supabase
      .from('group_trip_bookings')
      .select('*, group_trip:group_trips(*, boat:boats(*))')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) {
      await sendTelegramMessage(chatId, '❌ Бронирование групповой поездки не найдено', messageId)
      return
    }

    // Обновляем статус
    const { error: updateError } = await supabase
      .from('group_trip_bookings')
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (updateError) {
      await sendTelegramMessage(chatId, '❌ Ошибка обновления статуса', messageId)
      return
    }

    // Если отменяем - возвращаем места в поездку
    if (action === 'cancel') {
      const totalTickets = booking.adult_count + booking.child_count
      await supabase
        .from('group_trips')
        .update({
          available_seats: booking.group_trip.available_seats + totalTickets
        })
        .eq('id', booking.group_trip_id)
    }

    // Отправляем уведомление клиенту (если есть профиль)
    if (booking.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', booking.user_id)
        .single()

      if (profile?.telegram_id) {
        // Создаем объект для уведомления
        const bookingWithDetails = {
          ...booking,
          profile: profile,
          boat: booking.group_trip.boat
        }

        if (action === 'confirm') {
          const { sendGroupTripBookingConfirmation } = await import('~/server/utils/telegram-notifications')
          await sendGroupTripBookingConfirmation(bookingWithDetails)
        } else {
          // Отправляем уведомление об отмене
          await sendGroupTripCancellationNotification(bookingWithDetails)
        }
      }
    }

    // Обновляем сообщение в Telegram
    const statusText = action === 'confirm' ? 'подтверждено' : 'отменено'
    const emoji = action === 'confirm' ? '✅' : '❌'
    await sendTelegramMessage(
      chatId,
      `${emoji} Бронирование групповой поездки ${statusText}!`,
      messageId
    )

  } catch (error) {
    console.error('Error handling group trip booking action:', error)
    await sendTelegramMessage(chatId, '❌ Произошла ошибка', messageId)
  }
}

// Отправка Telegram сообщения
async function sendTelegramMessage(chatId: string, text: string, messageId?: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return

    const url = messageId
      ? `https://api.telegram.org/bot${token}/editMessageText`
      : `https://api.telegram.org/bot${token}/sendMessage`

    const body: any = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    }

    if (messageId) {
      body.message_id = messageId
    }

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (error) {
    console.error('Error sending Telegram message:', error)
  }
}

// Уведомление об отмене групповой поездки
async function sendGroupTripCancellationNotification(booking: any) {
  try {
    const message = `❌ <b>Бронирование групповой поездки отменено</b>

К сожалению, ваше бронирование на групповую поездку было отменено.

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
👥 <b>Билеты:</b> ${booking.adult_count} взр. + ${booking.child_count} дет.
💰 <b>Стоимость:</b> ${booking.total_price} ₽

📞 <i>Если у вас есть вопросы, свяжитесь с нами</i>`

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: booking.profile.telegram_id,
        text: message,
        parse_mode: 'HTML'
      })
    })
  } catch (error) {
    console.error('Error sending group trip cancellation notification:', error)
  }
}
