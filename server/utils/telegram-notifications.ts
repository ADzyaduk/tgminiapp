/**
 * Утилиты для работы с уведомлениями Telegram
 */

import { serverSupabaseClient } from '#supabase/server'
import { H3Event } from 'h3'

/**
 * Форматирует уведомление о новом бронировании
 */
export function formatBookingNotification(booking: any): string {
  const formattedDate = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  return `🆕 <b>Новое бронирование</b>
  
ID: ${booking.id}
Статус: <b>ожидает подтверждения</b>
Клиент: ${booking.profile?.name || 'Не указано'} (${booking.profile?.email || 'Нет email'})
Телефон: ${booking.profile?.phone || 'Не указан'}
Лодка: ${booking.boat?.name || 'Не указано'}
Дата: ${formattedDate}
Цена: ${booking.price} ₽

<i>Нажмите на кнопки ниже для управления бронированием</i>`
}

/**
 * Форматирует уведомление о статусе бронирования
 */
export function formatStatusNotification(booking: any, status: string): string {
  const statusEmoji = {
    pending: '⏳',
    confirmed: '✅',
    cancelled: '❌'
  }[status] || '🔔'
  
  const statusText = {
    pending: 'ожидает подтверждения',
    confirmed: 'подтверждено',
    cancelled: 'отменено'
  }[status] || 'изменило статус'
  
  const formattedDate = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  return `${statusEmoji} <b>Бронирование ${statusText}</b>
  
ID: ${booking.id}
Статус: <b>${statusText}</b>
Клиент: ${booking.profile?.name || 'Не указано'} (${booking.profile?.email || 'Нет email'})
Телефон: ${booking.profile?.phone || 'Не указан'}
Лодка: ${booking.boat?.name || 'Не указано'}
Дата: ${formattedDate}
Цена: ${booking.price} ₽

<i>Нажмите на кнопки ниже для управления бронированием</i>`
}

/**
 * Отправляет уведомление администраторам или менеджерам лодки
 */
export async function sendAdminNotification(
  message: string,
  options: {
    parseMode?: 'HTML' | 'Markdown',
    boatId?: string,
    bookingId?: string
  } = {}
): Promise<boolean> {
  const { parseMode = 'HTML', boatId, bookingId } = options
  
  try {
    const runtimeConfig = useRuntimeConfig()
    const token = runtimeConfig.public.telegramBotToken
    
    if (!token) {
      console.error('Telegram token not configured')
      return false
    }
    
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`
    
    // В реальном приложении тут должна быть логика получения
    // ID чата администраторов или менеджеров из базы данных
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID
    
    if (!adminChatId) {
      console.error('Admin chat ID not configured')
      return false
    }
    
    // Кнопки управления бронированием для инлайн-клавиатуры
    const inlineKeyboard = bookingId ? {
      inline_keyboard: [
        [
          { text: "✅ Подтвердить", callback_data: `booking:confirm:${bookingId}` },
          { text: "❌ Отменить", callback_data: `booking:cancel:${bookingId}` }
        ],
        [
          { text: "🔍 Детали", callback_data: `booking:details:${bookingId}` }
        ]
      ]
    } : undefined
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: message,
        parse_mode: parseMode,
        reply_markup: inlineKeyboard
      })
    })
    
    return response.ok
  } catch (error) {
    console.error('Failed to send admin notification:', error)
    return false
  }
}

/**
 * Отправляет уведомление всем менеджерам конкретной лодки
 */
export async function sendBoatManagersNotification(
  event: H3Event,
  boatId: string,
  message: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<boolean> {
  try {
    const supabase = serverSupabaseClient(event)
    
    // Получаем ID менеджеров этой лодки
    const { data: managers } = await supabase
      .from('boat_managers')
      .select('user_id')
      .eq('boat_id', boatId)
    
    if (!managers || managers.length === 0) {
      return false
    }
    
    // Получаем Telegram ID менеджеров
    const { data: profiles } = await supabase
      .from('profiles')
      .select('telegram_id')
      .in('id', managers.map((m: any) => m.user_id))
      .not('telegram_id', 'is', null)
    
    if (!profiles || profiles.length === 0) {
      return false
    }
    
    // Отправляем сообщение каждому менеджеру
    const runtimeConfig = useRuntimeConfig()
    const token = runtimeConfig.public.telegramBotToken
    
    if (!token) {
      console.error('Telegram token not configured')
      return false
    }
    
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`
    
    const results = await Promise.all(
      profiles.map(async (profile: any) => {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: profile.telegram_id,
              text: message,
              parse_mode: parseMode
            })
          })
          
          return response.ok
        } catch (error) {
          console.error(`Failed to send notification to manager ${profile.telegram_id}:`, error)
          return false
        }
      })
    )
    
    return results.some(Boolean)
  } catch (error) {
    console.error('Failed to send boat managers notification:', error)
    return false
  }
} 