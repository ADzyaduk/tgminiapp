import { defineEventHandler, getQuery } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { sendAdminNotification } from '~/server/utils/telegram-notifications'

/**
 * API для отправки напоминаний о предстоящих бронированиях
 * Этот API должен вызываться через планировщик задач (cron)
 * 
 * Примеры использования:
 * - Ежедневное напоминание о бронированиях на следующий день: /api/cron/send-reminders?days=1
 * - Напоминание за 3 часа до бронирования: /api/cron/send-reminders?hours=3
 */
export default defineEventHandler(async (event) => {
  try {
    // Получаем query-параметры для настройки периода напоминаний
    const query = getQuery(event)
    const days = Number(query.days) || 0
    const hours = Number(query.hours) || 0
    
    // Проверяем, что указан хотя бы один период
    if (days <= 0 && hours <= 0) {
      return {
        status: 400,
        body: { error: 'Укажите period в днях (days) или часах (hours)' }
      }
    }
    
    // Получаем секретный ключ для проверки авторизации cron-задачи
    const cronSecret = query.secret
    const configSecret = process.env.CRON_SECRET
    
    // Проверяем авторизацию, если задан секретный ключ
    if (configSecret && cronSecret !== configSecret) {
      return { 
        status: 401,
        body: { error: 'Unauthorized' } 
      }
    }
    
    // Подключаемся к Supabase с сервисной ролью
    const supabase = serverSupabaseServiceRole(event)
    
    // Рассчитываем временной диапазон для напоминаний
    const now = new Date()
    
    // Начало диапазона - текущее время
    const startTime = new Date(now)
    
    // Конец диапазона - текущее время + указанный период
    const endTime = new Date(now)
    if (days > 0) {
      endTime.setDate(endTime.getDate() + days)
    }
    if (hours > 0) {
      endTime.setHours(endTime.getHours() + hours)
    }
    
    // Получаем все подтвержденные бронирования в диапазоне
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(name, phone, telegram_id), boat:boat_id(name, id)')
      .eq('status', 'confirmed')
      .gte('start_time', startTime.toISOString())
      .lt('start_time', endTime.toISOString())
      .order('start_time', { ascending: true })
    
    if (error) {
      console.error('Error fetching bookings for reminders:', error)
      return { 
        status: 500, 
        body: { error: 'Failed to fetch bookings' } 
      }
    }
    
    if (!bookings || bookings.length === 0) {
      return { 
        status: 200, 
        body: { message: 'No bookings to send reminders for', count: 0 } 
      }
    }
    
    // Отправляем напоминания
    const reminderResults = await Promise.allSettled(
      bookings.map(async (booking) => {
        // Форматируем сообщение напоминания
        const reminderMessage = formatReminderMessage(booking, days, hours)
        
        // 1. Отправляем напоминание клиенту, если есть Telegram ID
        if (booking.profile?.telegram_id) {
          await sendClientReminder(booking, reminderMessage)
        }
        
        // 2. Отправляем напоминание администраторам и менеджерам
        await sendAdminNotification(reminderMessage, {
          parseMode: 'HTML',
          boatId: booking.boat_id,
          bookingId: booking.id
        })
        
        return booking.id
      })
    )
    
    // Считаем успешные отправки
    const successCount = reminderResults.filter(r => r.status === 'fulfilled').length
    
    return { 
      status: 200, 
      body: { 
        message: `Sent ${successCount} of ${bookings.length} reminders`,
        count: successCount
      } 
    }
  } catch (error) {
    console.error('Error sending reminders:', error)
    return { 
      status: 500, 
      body: { error: 'Internal server error' } 
    }
  }
})

// Отправка напоминания клиенту через Telegram
async function sendClientReminder(booking: any, message: string): Promise<boolean> {
  if (!booking.profile?.telegram_id) return false
  
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
    console.error('Error sending reminder to client:', error)
    return false
  }
}

// Форматирование сообщения напоминания
function formatReminderMessage(booking: any, days: number, hours: number): string {
  const startTime = new Date(booking.start_time)
  const formattedDate = startTime.toLocaleDateString('ru-RU')
  const formattedTime = startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  
  let reminderType = ''
  if (days === 1) {
    reminderType = 'завтра'
  } else if (days > 1) {
    reminderType = `через ${days} ${getDayWord(days)}`
  } else if (hours > 0) {
    reminderType = `через ${hours} ${getHourWord(hours)}`
  }
  
  let message = `<b>⏰ Напоминание о бронировании ${reminderType}</b>\n\n`
  message += `🚤 Лодка: <b>${booking.boat.name}</b>\n`
  message += `📅 Дата: <b>${formattedDate}</b>\n`
  message += `⏰ Время: <b>${formattedTime}</b>\n`
  
  if (booking.profile) {
    message += `👤 Клиент: <b>${booking.profile.name || 'Не указано'}</b>\n`
    
    if (booking.profile.phone) {
      message += `📞 Телефон: <b>${booking.profile.phone}</b>\n`
    }
  }
  
  if (booking.guests_count) {
    message += `👥 Гостей: <b>${booking.guests_count}</b>\n`
  }
  
  return message
}

// Вспомогательные функции для склонения слов
function getDayWord(days: number): string {
  const lastDigit = days % 10
  const lastTwoDigits = days % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'дней'
  }
  
  if (lastDigit === 1) {
    return 'день'
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня'
  }
  
  return 'дней'
}

function getHourWord(hours: number): string {
  const lastDigit = hours % 10
  const lastTwoDigits = hours % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'часов'
  }
  
  if (lastDigit === 1) {
    return 'час'
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'часа'
  }
  
  return 'часов'
} 