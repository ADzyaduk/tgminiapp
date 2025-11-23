import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/supabase'
import { answerCallbackQuery, editMessageText, sendMessage } from '~/server/utils/telegram-client'
type Booking = Database['public']['Tables']['bookings']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Boat = Database['public']['Tables']['boats']['Row']

type CallbackAction = 'confirm' | 'cancel'
type CallbackBookingType = 'regular' | 'group_trip'

type CallbackPayload = {
  bookingType: CallbackBookingType
  action: CallbackAction
  bookingId: string
}

function parseCallbackPayload (rawData: string): CallbackPayload | null {
  if (!rawData || typeof rawData !== 'string') {
    return null
  }

  const parts = rawData.split(':')
  if (parts.length < 3) {
    return null
  }

  const [bookingType, action, ...idParts] = parts
  const bookingId = idParts.join(':').trim()

  if (!bookingType || !bookingId) {
    return null
  }

  if (action !== 'confirm' && action !== 'cancel') {
    return null
  }

  if (bookingType !== 'regular' && bookingType !== 'group_trip') {
    return null
  }

  return {
    bookingType,
    action,
    bookingId
  }
}

/**
 * Handle callback_query (button clicks)
 */
async function handleCallbackQuery(event: H3Event, update: any) {
  const { callback_query } = update
  
  if (!callback_query) {
    return { ok: true }
  }

  const { id, data, message, from } = callback_query

  console.log('📱 Callback query received:', { id, data, from_id: from.id })
  await answerCallbackQuery({ callbackQueryId: id })

  if (!message?.chat?.id || !message.message_id) {
    console.error('❌ Callback without message context:', { id, data })
    await answerCallbackQuery({
      callbackQueryId: id,
      text: '❌ Сообщение недоступно',
      showAlert: true
    })
    return { ok: true }
  }

  const payload = parseCallbackPayload(data)

  if (!payload) {
    console.error('❌ Invalid callback payload:', data)
    await answerCallbackQuery({
      callbackQueryId: id,
      text: '❌ Ошибка: неверные данные',
      showAlert: true
    })
    return { ok: true }
  }

  const { bookingType, action, bookingId } = payload

  console.log(`🔄 Processing ${action} for ${bookingType} booking ${bookingId}`)

  const supabase = serverSupabaseServiceRole<Database>(event)
  const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'

  try {
    if (bookingType === 'regular') {
      // Обновляем обычное бронирование
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('*, profile:profiles(*), boat:boats(*)')
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        console.error('❌ Booking not found:', bookingId)
        await editMessageText({
          chatId: message.chat.id,
          messageId: message.message_id,
          text: `❌ Бронирование не найдено: ${bookingId}`
        })
        return { ok: true }
      }

      if (booking.status !== 'pending') {
        await editMessageText({
          chatId: message.chat.id,
          messageId: message.message_id,
          text: `ℹ️ Бронирование уже обработано. Статус: ${booking.status}`
        })
        return { ok: true }
      }

      const { data: updated, error: updateError } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .select('*, profile:profiles(*), boat:boats(*)')
        .single()

      if (updateError || !updated) {
        console.error('❌ Update error:', updateError)
        await editMessageText({
          chatId: message.chat.id,
          messageId: message.message_id,
          text: '❌ Ошибка обновления статуса'
        })
        return { ok: true }
      }

      // Обновляем сообщение
      const statusText = newStatus === 'confirmed' ? '✅ ПОДТВЕРЖДЕНО' : '❌ ОТМЕНЕНО'
      const clientName = updated.profile?.name || updated.guest_name || 'Не указано'
      const messageText = `${statusText}\n\n` +
        `🛥️ Лодка: ${updated.boat?.name || 'Неизвестно'}\n` +
        `👤 Клиент: ${clientName}\n` +
        `📅 Дата: ${new Date(updated.start_time).toLocaleDateString('ru-RU')}\n` +
        `⏰ Время: ${new Date(updated.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`

      await editMessageText({
        chatId: message.chat.id,
        messageId: message.message_id,
        text: messageText,
        parseMode: 'HTML',
        replyMarkup: { inline_keyboard: [] }
      })

      // Уведомляем клиента
      if (updated.profile?.telegram_id) {
        const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications')
        await sendClientStatusNotification(updated as any, newStatus)
      }

      console.log(`✅ Booking ${bookingId} updated to ${newStatus}`)

    } else if (bookingType === 'group_trip') {
      // Обновляем групповую поездку
      const { data: booking, error } = await supabase
        .from('group_trip_bookings')
        .select('*, profile:profiles(*), group_trip:group_trips(*, boat:boats(*))')
        .eq('id', bookingId)
        .single()

      if (error || !booking) {
        console.error('❌ Group trip booking not found:', bookingId)
        await editMessageText({
          chatId: message.chat.id,
          messageId: message.message_id,
          text: `❌ Бронирование не найдено: ${bookingId}`
        })
        return { ok: true }
      }

      if (booking.status === 'cancelled') {
        await editMessageText({
          chatId: message.chat.id,
          messageId: message.message_id,
          text: 'ℹ️ Бронирование уже отменено'
        })
        return { ok: true }
      }

      const { data: updated, error: updateError } = await supabase
        .from('group_trip_bookings')
        .update({ status: newStatus })
        .eq('id', bookingId)
        .select('*, profile:profiles(*), group_trip:group_trips(*, boat:boats(*))')
        .single()

      if (updateError || !updated) {
        console.error('❌ Update error:', updateError)
        await editMessageText({
          chatId: message.chat.id,
          messageId: message.message_id,
          text: '❌ Ошибка обновления статуса'
        })
        return { ok: true }
      }

      const statusText = newStatus === 'confirmed' ? '✅ ПОДТВЕРЖДЕНО' : '❌ ОТМЕНЕНО'
      const clientName = updated.profile?.name || updated.guest_name || 'Не указано'
      const messageText = `${statusText}\n\n` +
        `🚤 Лодка: ${updated.group_trip?.boat?.name || 'Неизвестно'}\n` +
        `👤 Клиент: ${clientName}\n` +
        `📅 Дата: ${updated.group_trip?.start_time ? new Date(updated.group_trip.start_time).toLocaleDateString('ru-RU') : 'Не указано'}`

      await editMessageText({
        chatId: message.chat.id,
        messageId: message.message_id,
        text: messageText,
        parseMode: 'HTML',
        replyMarkup: { inline_keyboard: [] }
      })

      if (updated.profile?.telegram_id) {
        const { sendGroupTripStatusNotification } = await import('~/server/utils/telegram-notifications')
        await sendGroupTripStatusNotification(updated as any, newStatus)
      }

    }

    return { ok: true }
  } catch (error: any) {
    console.error('❌ Error processing callback:', error)
    return { ok: true }
  }
}

/**
 * Handle text messages (commands)
 */
async function handleMessage(event: H3Event, update: any) {
  const { message } = update
  
  if (!message || !message.text) {
    return { ok: true }
  }

  const { chat, text, from } = message
  const command = text.split(' ')[0].toLowerCase()
  const args = text.split(' ').slice(1)

  console.log(`💬 Message received: ${command} from ${from.id}`)
  const supabase = serverSupabaseServiceRole<Database>(event)

  // Admin commands
  if (command.startsWith('/admin')) {
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('telegram_id', from.id.toString())
      .eq('role', 'admin')
      .single()

    if (!adminUser) {
      await sendMessage({ chatId: chat.id, text: '❌ У вас нет прав администратора' })
      return { ok: true }
    }

    const adminCommands = await import('~/server/api/telegram/admin-commands.post')

    switch (command) {
      case '/admin':
        return await adminCommands.handleAdminMenu(chat.id)
      case '/adminstats':
        return await adminCommands.handleAdminStats(chat.id, supabase)
      case '/admintoday':
        return await adminCommands.handleTodayBookings(chat.id, supabase)
      case '/adminremind':
        return await adminCommands.handleSendReminders(chat.id, event)
      case '/adminwebhook':
        return await adminCommands.handleWebhookCheck(chat.id)
      default:
        await sendMessage({ chatId: chat.id, text: '❓ Неизвестная команда. Используйте /admin' })
        return { ok: true }
    }
  }

  // Regular commands
  const botCommands = await import('~/server/utils/telegram-bot-commands')

  switch (command) {
    case '/start':
      return await botCommands.handleStartCommand(chat.id, from, supabase)
    case '/help':
      return await botCommands.handleHelpCommand(chat.id)
    case '/mybookings':
      return await botCommands.handleMyBookingsCommand(chat.id, from, supabase)
    case '/status':
      return await botCommands.handleStatusCommand(chat.id, from, supabase)
    default:
      await sendMessage({ chatId: chat.id, text: '👋 Привет! Используйте /start для открытия приложения.' })
      return { ok: true }
  }
}

/**
 * Main webhook handler
 * Согласно документации Telegram Bot API, Update объект может содержать:
 * - message
 * - callback_query
 * - и другие типы обновлений
 */
export default defineEventHandler(async (event: H3Event) => {
  // ВСЕГДА возвращаем 200 OK для Telegram
  setResponseStatus(event, 200)

  try {
    const update = await readBody(event)

    if (!update || !update.update_id) {
      console.log('⚠️ Invalid update received')
      return { ok: true }
    }

    console.log(`🔔 Update #${update.update_id} received`)

    // Обрабатываем callback_query (нажатия на кнопки)
    if (update.callback_query) {
      console.log('📱 Processing callback_query...')
      const result = await handleCallbackQuery(event, update)
      return result
    }

    // Обрабатываем сообщения (команды)
    if (update.message) {
      console.log('💬 Processing message...')
      const result = await handleMessage(event, update)
      return result
    }

    // Другие типы обновлений пока не обрабатываем
    console.log('ℹ️ Update type not handled:', Object.keys(update).filter(k => k !== 'update_id'))
    return { ok: true }

  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    console.error('❌ Stack:', error.stack)
    
    // ВСЕГДА возвращаем 200 OK, иначе Telegram перестанет отправлять обновления
    return { ok: true }
  }
})
