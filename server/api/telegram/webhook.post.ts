import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/supabase'
import { addLog } from '~/server/utils/telegram-logs'

type Booking = Database['public']['Tables']['bookings']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Boat = Database['public']['Tables']['boats']['Row']

type BookingWithDetails = Booking & {
  profile: Profile | null
  boat: Boat | null
}

/**
 * Telegram Bot API Helper Functions
 */
const TELEGRAM_API_URL = 'https://api.telegram.org/bot'

async function callTelegramAPI(method: string, params: Record<string, any>): Promise<any> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set')
    return null
  }

  const url = `${TELEGRAM_API_URL}${token}/${method}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    const result = await response.json()
    
    if (!result.ok) {
      console.error(`❌ Telegram API error (${method}):`, result)
      return null
    }

    return result.result
  } catch (error) {
    console.error(`❌ Network error calling ${method}:`, error)
    return null
  }
}

async function sendMessage(chatId: number, text: string, options: {
  parse_mode?: 'HTML' | 'Markdown'
  reply_markup?: any
} = {}): Promise<boolean> {
  const result = await callTelegramAPI('sendMessage', {
    chat_id: chatId,
    text,
    ...options
  })
  return result !== null
}

async function answerCallbackQuery(callbackQueryId: string, options: {
  text?: string
  show_alert?: boolean
  url?: string
} = {}): Promise<boolean> {
  const result = await callTelegramAPI('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...options
  })
  return result !== null
}

async function editMessageText(chatId: number, messageId: number, text: string, options: {
  parse_mode?: 'HTML'
  reply_markup?: any
} = {}): Promise<boolean> {
  const result = await callTelegramAPI('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...options
  })
  return result !== null
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
  addLog('info', 'Callback query', { id, data, userId: from.id })

  // СРАЗУ отвечаем на callback_query (обязательно по документации Telegram)
  await answerCallbackQuery(id, { text: '' })

  // Парсим callback_data: bookingType:action:bookingId
  const parts = data.split(':')
  if (parts.length < 3) {
    console.error('❌ Invalid callback_data format:', data)
    await answerCallbackQuery(id, { text: '❌ Ошибка: неверный формат', show_alert: true })
    return { ok: true }
  }

  const [bookingType, action, ...idParts] = parts
  const bookingId = idParts.join(':').trim()

  if (!bookingType || !action || !bookingId) {
    console.error('❌ Missing parts in callback_data:', { bookingType, action, bookingId })
    await answerCallbackQuery(id, { text: '❌ Ошибка: неверные данные', show_alert: true })
    return { ok: true }
  }

  if (action !== 'confirm' && action !== 'cancel') {
    console.error('❌ Invalid action:', action)
    await answerCallbackQuery(id, { text: '❌ Ошибка: неверное действие', show_alert: true })
    return { ok: true }
  }

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
        await editMessageText(message.chat.id, message.message_id, 
          `❌ Бронирование не найдено: ${bookingId}`)
        return { ok: true }
      }

      if (booking.status !== 'pending') {
        await editMessageText(message.chat.id, message.message_id,
          `ℹ️ Бронирование уже обработано. Статус: ${booking.status}`)
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
        await editMessageText(message.chat.id, message.message_id,
          `❌ Ошибка обновления статуса`)
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

      await editMessageText(message.chat.id, message.message_id, messageText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      })

      // Уведомляем клиента
      if (updated.profile?.telegram_id) {
        const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications')
        await sendClientStatusNotification(updated as any, newStatus)
      }

      addLog('success', `Booking ${bookingId} ${newStatus}`, { bookingId, action })
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
        await editMessageText(message.chat.id, message.message_id,
          `❌ Бронирование не найдено: ${bookingId}`)
        return { ok: true }
      }

      if (booking.status === 'cancelled') {
        await editMessageText(message.chat.id, message.message_id,
          `ℹ️ Бронирование уже отменено`)
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
        await editMessageText(message.chat.id, message.message_id,
          `❌ Ошибка обновления статуса`)
        return { ok: true }
      }

      const statusText = newStatus === 'confirmed' ? '✅ ПОДТВЕРЖДЕНО' : '❌ ОТМЕНЕНО'
      const clientName = updated.profile?.name || updated.guest_name || 'Не указано'
      const messageText = `${statusText}\n\n` +
        `🚤 Лодка: ${updated.group_trip?.boat?.name || 'Неизвестно'}\n` +
        `👤 Клиент: ${clientName}\n` +
        `📅 Дата: ${updated.group_trip?.start_time ? new Date(updated.group_trip.start_time).toLocaleDateString('ru-RU') : 'Не указано'}`

      await editMessageText(message.chat.id, message.message_id, messageText, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] }
      })

      if (updated.profile?.telegram_id) {
        const { sendGroupTripStatusNotification } = await import('~/server/utils/telegram-notifications')
        await sendGroupTripStatusNotification(updated as any, newStatus)
      }

      addLog('success', `Group trip booking ${bookingId} ${newStatus}`, { bookingId, action })
    }

    return { ok: true }
  } catch (error: any) {
    console.error('❌ Error processing callback:', error)
    addLog('error', 'Callback processing error', { error: error.message })
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
  addLog('info', 'Message received', { command, userId: from.id })

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
      await sendMessage(chat.id, '❌ У вас нет прав администратора')
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
      case '/adminlogs':
        return await adminCommands.handleAdminLogs(chat.id, args)
      case '/adminwebhook':
        return await adminCommands.handleWebhookCheck(chat.id)
      case '/admintest':
        return await adminCommands.handleTestButtons(chat.id)
      default:
        await sendMessage(chat.id, '❓ Неизвестная команда. Используйте /admin')
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
      await sendMessage(chat.id, '👋 Привет! Используйте /start для открытия приложения.')
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
    addLog('error', 'Webhook error', { error: error.message, stack: error.stack })
    
    // ВСЕГДА возвращаем 200 OK, иначе Telegram перестанет отправлять обновления
    return { ok: true }
  }
})
