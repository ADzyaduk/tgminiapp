import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

/**
 * Обработчик специальных команд для администраторов
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Проверка наличия сообщения
    if (!body || !body.message) {
      return { status: 400, body: { error: 'Invalid request' } }
    }

    const { message } = body
    const { chat, text, from } = message

    if (!text || !text.startsWith('/admin')) {
      return { status: 200, body: { success: true } }
    }

    const supabase = await serverSupabaseClient(event)

    // Проверяем, что пользователь - администратор
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id, role, name')
      .eq('telegram_id', from.id.toString())
      .eq('role', 'admin')
      .single()

    if (!adminUser) {
      await sendMessage(chat.id, '❌ У вас нет прав администратора')
      return { status: 403, body: { error: 'Access denied' } }
    }

    const command = text.split(' ')[0].toLowerCase()
    const args = text.split(' ').slice(1)

    switch (command) {
      case '/admin':
        return await handleAdminMenu(chat.id)

      case '/adminstats':
        return await handleAdminStats(chat.id, supabase)

      case '/admintoday':
        return await handleTodayBookings(chat.id, supabase)

      case '/adminremind':
        return await handleSendReminders(chat.id, event)

      default:
        await sendMessage(chat.id, '❓ Неизвестная команда администратора. Используйте /admin для просмотра доступных команд.')
    }

    return { status: 200, body: { success: true } }
  } catch (error) {
    console.error('Error in admin commands handler:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})

// Главное меню администратора
async function handleAdminMenu(chatId: number) {
  const message = `👑 <b>Меню администратора</b>

📊 Доступные команды:
/adminstats - Статистика бронирований
/admintoday - Бронирования на сегодня
/adminremind - Отправить напоминания

🔔 Вы также получаете автоматические уведомления о новых бронированиях.`

  return await sendMessage(chatId, message)
}

// Статистика бронирований
async function handleAdminStats(chatId: number, supabase: any) {
  try {
    // Получаем статистику за последние 30 дней
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: allBookings } = await supabase
      .from('bookings')
      .select('status, price, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())

    const { data: todayBookings } = await supabase
      .from('bookings')
      .select('status')
      .gte('created_at', new Date().toISOString().split('T')[0])

    if (!allBookings) {
      return await sendMessage(chatId, '❌ Ошибка получения статистики')
    }

    const total = allBookings.length
    const confirmed = allBookings.filter((b: any) => b.status === 'confirmed').length
    const pending = allBookings.filter((b: any) => b.status === 'pending').length
    const cancelled = allBookings.filter((b: any) => b.status === 'cancelled').length

    const totalRevenue = allBookings
      .filter((b: any) => b.status === 'confirmed')
      .reduce((sum: number, b: any) => sum + (b.price || 0), 0)

    const todayTotal = todayBookings?.length || 0

    const message = `📊 <b>Статистика за 30 дней</b>

📈 Всего бронирований: ${total}
✅ Подтверждено: ${confirmed}
⏳ Ожидает: ${pending}
❌ Отменено: ${cancelled}

💰 Выручка: ${totalRevenue.toLocaleString('ru-RU')} ₽

📅 Сегодня: ${todayTotal} новых бронирований

🎯 Конверсия: ${total > 0 ? Math.round((confirmed / total) * 100) : 0}%`

    return await sendMessage(chatId, message)
  } catch (error) {
    console.error('Error getting admin stats:', error)
    return await sendMessage(chatId, '❌ Ошибка получения статистики')
  }
}

// Бронирования на сегодня
async function handleTodayBookings(chatId: number, supabase: any) {
  try {
    const today = new Date()
    const startOfDay = new Date(today)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(today)
    endOfDay.setHours(23, 59, 59, 999)

    const { data: bookings } = await supabase
      .from('bookings')
      .select('*, profile:user_id(name, phone), boat:boat_id(name)')
      .eq('status', 'confirmed')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true })

    if (!bookings || bookings.length === 0) {
      return await sendMessage(chatId, '📅 На сегодня нет подтвержденных бронирований')
    }

    let message = `📅 <b>Бронирования на сегодня (${bookings.length})</b>\n\n`

    bookings.forEach((booking: any, index: number) => {
      const time = new Date(booking.start_time).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })

      message += `${index + 1}. <b>${time}</b> - ${booking.boat?.name || 'Лодка'}
👤 ${booking.profile?.name || 'Без имени'}
📞 ${booking.profile?.phone || 'Без телефона'}
💰 ${booking.price} ₽

`
    })

    return await sendMessage(chatId, message)
  } catch (error) {
    console.error('Error getting today bookings:', error)
    return await sendMessage(chatId, '❌ Ошибка получения бронирований')
  }
}

// Отправка напоминаний
async function handleSendReminders(chatId: number, event: any) {
  try {
    await sendMessage(chatId, '📤 Отправляю напоминания...')

    // Вызываем API напоминаний
    const response = await fetch(`${getBaseUrl(event)}/api/telegram/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()

    if (result.status === 200) {
      await sendMessage(chatId, `✅ ${result.body.message}`)
    } else {
      await sendMessage(chatId, '❌ Ошибка отправки напоминаний')
    }
  } catch (error) {
    console.error('Error sending reminders:', error)
    await sendMessage(chatId, '❌ Ошибка отправки напоминаний')
  }
}

// Получение базового URL
function getBaseUrl(event: any): string {
  const host = event.node.req.headers.host
  const protocol = event.node.req.headers['x-forwarded-proto'] || 'http'
  return `${protocol}://${host}`
}

// Функция для отправки сообщения
async function sendMessage(chatId: number, text: string) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) return false

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    })

    return response.ok
  } catch (error) {
    console.error('Error sending message:', error)
    return false
  }
}
