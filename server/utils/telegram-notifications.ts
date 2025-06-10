/**
 * Утилиты для работы с уведомлениями Telegram
 */

import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'
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

  // Получаем телефон из guest_phone (Telegram не предоставляет номер телефона через Bot API)
  const phoneNumber = booking.guest_phone || 'Не указан'

  // Получаем имя из guest_name или profile.name
  const clientName = booking.guest_name || booking.profile?.name || 'Не указано'

  // Получаем email если есть профиль
  const emailPart = booking.profile?.email ? ` (${booking.profile.email})` : ''

  return `Клиент: ${clientName}${emailPart}
Телефон: ${phoneNumber}
Лодка: ${booking.boat?.name || 'Не указано'}
Дата: ${formattedDate}`
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
Телефон: ${booking.guest_phone || 'Не указан'}
Лодка: ${booking.boat?.name || 'Не указано'}
Дата: ${formattedDate}
Цена: ${booking.price} ₽

<i>Нажмите на кнопки ниже для управления бронированием</i>`
}

/**
 * Форматирует уведомление о статусе групповой поездки
 */
export function formatGroupTripStatusNotification(booking: any, status: string): string {
  const statusEmoji = {
    confirmed: '✅',
    completed: '🏁',
    cancelled: '❌'
  }[status] || '🔔'

  const statusText = {
    confirmed: 'подтверждено',
    completed: 'завершено',
    cancelled: 'отменено'
  }[status] || 'изменило статус'

  const formattedDate = new Date(booking.group_trip?.start_time).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const totalTickets = booking.adult_count + booking.child_count
  const clientName = booking.guest_name || booking.profile?.name || 'Не указано'

  return `${statusEmoji} <b>Групповая поездка ${statusText}</b>

ID: ${booking.id}
Статус: <b>${statusText}</b>
Клиент: ${clientName} (${booking.profile?.email || 'Нет email'})
Телефон: ${booking.guest_phone || 'Не указан'}
Лодка: ${booking.boat?.name || 'Не указано'}
Дата: ${formattedDate}
Билеты: ${booking.adult_count} взр. + ${booking.child_count} дет. = ${totalTickets} мест
Стоимость: ${booking.total_price} ₽`
}

/**
 * Отправляет уведомление клиенту о смене статуса групповой поездки
 */
export async function sendGroupTripStatusNotification(
  booking: any,
  status: string,
  managerName?: string
): Promise<boolean> {
  // Проверяем наличие Telegram ID у клиента
  if (!booking.profile?.telegram_id) {
    console.log('Client has no telegram_id, skipping group trip status notification')
    return false
  }

  const statusEmoji = {
    confirmed: '✅',
    completed: '🏁',
    cancelled: '❌'
  }[status] || '🔔'

  const statusText = {
    confirmed: 'подтверждено',
    completed: 'завершено',
    cancelled: 'отменено'
  }[status] || 'изменило статус'

  const formattedDate = new Date(booking.group_trip?.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const totalTickets = booking.adult_count + booking.child_count
  const managerPart = managerName ? ` (${managerName})` : ''

  const message = `${statusEmoji} <b>Статус групповой поездки изменен</b>

Ваше бронирование групповой поездки ${statusText} менеджером${managerPart}.

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
👥 <b>Билеты:</b> ${booking.adult_count} взр. + ${booking.child_count} дет. = ${totalTickets} мест
💰 <b>Стоимость:</b> ${booking.total_price} ₽
🎯 <b>Новый статус:</b> ${statusText}

${status === 'cancelled' ? '😞 <i>Приносим извинения за отмену!</i>' : '🎉 <i>Спасибо за ваш выбор!</i>'}`

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error('Telegram token not configured')
      return false
    }

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

    if (response.ok) {
      console.log(`✅ Sent group trip status notification to client: ${booking.profile.telegram_id}`)
      return true
    } else {
      console.error(`❌ Failed to send group trip status notification to client: ${booking.profile.telegram_id}`)
      return false
    }
  } catch (error) {
    console.error('Error sending group trip status notification to client:', error)
    return false
  }
}

/**
 * Отправляет уведомление администраторам или менеджерам лодки
 */
export async function sendAdminNotification(
  message: string,
  options: {
    parseMode?: 'HTML' | 'Markdown',
    boatId?: string,
    bookingId?: string,
    bookingType?: 'regular' | 'group_trip',
    event?: H3Event
  } = {}
): Promise<boolean> {
  const { parseMode = 'HTML', boatId, bookingId, bookingType = 'regular', event } = options

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!token) {
      console.error('Telegram token not configured')
      return false
    }

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    // Создаем инлайн кнопки для бронирований
    let replyMarkup = undefined
    if (bookingId && bookingType) {
      // Ограничиваем длину callback_data до 64 байт согласно документации Telegram
      const confirmData = `${bookingType}:confirm:${bookingId}`.substring(0, 64)
      const cancelData = `${bookingType}:cancel:${bookingId}`.substring(0, 64)

      console.log(`🔘 Creating inline buttons:`)
      console.log(`   ✅ Confirm: ${confirmData}`)
      console.log(`   ❌ Cancel: ${cancelData}`)

      replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '✅ Подтвердить',
              callback_data: confirmData
            },
            {
              text: '❌ Отменить',
              callback_data: cancelData
            }
          ]
        ]
      }
    }

    // Сначала пытаемся отправить менеджерам лодки, если указан boatId
    let sentToManagers = false
    if (boatId && event) {
      try {
        const supabase = serverSupabaseServiceRole(event)

        // Получаем менеджеров этой лодки
        const { data: managers } = await supabase
          .from('boat_managers')
          .select('user_id')
          .eq('boat_id', boatId)

        if (managers && managers.length > 0) {
          // Получаем Telegram ID менеджеров
          const { data: profiles } = await supabase
            .from('profiles')
            .select('telegram_id')
            .in('id', managers.map((m: any) => m.user_id))
            .not('telegram_id', 'is', null)

          if (profiles && profiles.length > 0) {
            // Отправляем уведомление каждому менеджеру с кнопками
            const results = await Promise.all(
              profiles.map(async (profile: any) => {
                try {
                  const body: any = {
                    chat_id: profile.telegram_id,
                    text: message,
                    parse_mode: parseMode
                  }

                  if (replyMarkup) {
                    body.reply_markup = replyMarkup
                  }

                  const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                  })

                  return response.ok
                } catch (error) {
                  console.error(`Failed to send notification to manager ${profile.telegram_id}:`, error)
                  return false
                }
              })
            )

            sentToManagers = results.some(Boolean)
            console.log(`Sent notifications to ${results.filter(Boolean).length} boat managers`)
          }
        }
      } catch (error) {
        console.error('Error sending notifications to boat managers:', error)
      }
    }

    // Если не удалось отправить менеджерам или нет менеджеров, отправляем админу
    if (!sentToManagers) {
      const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID === "ваш_chat_id_для_уведомлений"
        ? "1231157381"  // Реальный chat ID из логов
        : (process.env.TELEGRAM_ADMIN_CHAT_ID || "1231157381")

      console.log(`📤 Sending notification to admin chat ID: ${adminChatId}`)
      console.log(`📝 Message: ${message.substring(0, 100)}...`)

      const body: any = {
        chat_id: adminChatId,
        text: message,
        parse_mode: parseMode
      }

      if (replyMarkup) {
        console.log(`🔘 Adding buttons: ${JSON.stringify(replyMarkup)}`)
        body.reply_markup = replyMarkup
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const result = response.ok
      if (!result) {
        const errorData = await response.json()
        console.error(`❌ Admin notification failed:`, errorData)
      } else {
        console.log(`✅ Admin notification sent successfully`)
      }
      return result
    }

    return sentToManagers
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
    const supabase = serverSupabaseServiceRole(event)

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
    const token = process.env.TELEGRAM_BOT_TOKEN

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

/**
 * Отправляет красивое уведомление клиенту об изменении статуса бронирования
 */
export async function sendClientStatusNotification(
  booking: any,
  status: string,
  managerName?: string
): Promise<boolean> {
  // Проверяем наличие Telegram ID у клиента
  if (!booking.profile?.telegram_id) {
    console.log('Client has no telegram_id, skipping notification')
    return false
  }

  const statusConfig = {
    pending: {
      emoji: '⏳',
      title: 'Бронирование получено',
      description: 'Ваше бронирование поступило к нам и ожидает подтверждения менеджера.',
      color: '🟡'
    },
    confirmed: {
      emoji: '✅',
      title: 'Бронирование подтверждено',
      description: 'Отлично! Ваше бронирование подтверждено. Ждём вас в указанное время!',
      color: '🟢'
    },
    cancelled: {
      emoji: '❌',
      title: 'Бронирование отменено',
      description: 'К сожалению, ваше бронирование было отменено. Для уточнения деталей свяжитесь с нами.',
      color: '🔴'
    }
  }

  const config = statusConfig[status as keyof typeof statusConfig]
  if (!config) return false

  const formattedDate = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const formattedEndTime = new Date(booking.end_time).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const duration = Math.round((new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60))

  const managerInfo = managerName ? `\n👤 <b>Менеджер:</b> ${managerName}` : ''

  const message = `${config.emoji} <b>${config.title}</b>

${config.description}

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
⏰ <b>Время:</b> ${new Date(booking.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${formattedEndTime}
⏱️ <b>Продолжительность:</b> ${duration} ч.
💰 <b>Стоимость:</b> ${booking.price} ₽
👥 <b>Количество гостей:</b> ${booking.peoples || 1}${managerInfo}

${status === 'confirmed' ? '🎉 <i>Хорошего отдыха!</i>' : status === 'cancelled' ? '📞 <i>При вопросах обращайтесь к администратору</i>' : '⏰ <i>Мы свяжемся с вами в ближайшее время</i>'}`

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error('Telegram token not configured')
      return false
    }

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

    if (response.ok) {
      console.log(`✅ Sent status notification to client: ${booking.profile.telegram_id}`)
      return true
    } else {
      console.error(`❌ Failed to send status notification to client: ${booking.profile.telegram_id}`)
      return false
    }
  } catch (error) {
    console.error('Error sending status notification to client:', error)
    return false
  }
}

/**
 * Отправляет уведомление о новом бронировании клиенту (подтверждение получения)
 */
export async function sendClientBookingConfirmation(booking: any): Promise<boolean> {
  // Проверяем наличие Telegram ID у клиента
  if (!booking.profile?.telegram_id) {
    console.log('Client has no telegram_id, skipping confirmation')
    return false
  }

  const formattedDate = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const formattedEndTime = new Date(booking.end_time).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const duration = Math.round((new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60))

  const message = `📝 <b>Бронирование создано!</b>

Спасибо за ваше обращение! Мы получили вашу заявку на бронирование.

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
⏰ <b>Время:</b> ${new Date(booking.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${formattedEndTime}
⏱️ <b>Продолжительность:</b> ${duration} ч.
💰 <b>Стоимость:</b> ${booking.price} ₽
👥 <b>Количество гостей:</b> ${booking.peoples || 1}

⏳ <i>Ваше бронирование ожидает подтверждения менеджера. Мы свяжемся с вами в ближайшее время!</i>`

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error('Telegram token not configured')
      return false
    }

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

    if (response.ok) {
      console.log(`✅ Sent booking confirmation to client: ${booking.profile.telegram_id}`)
      return true
    } else {
      console.error(`❌ Failed to send booking confirmation to client: ${booking.profile.telegram_id}`)
      return false
    }
  } catch (error) {
    console.error('Error sending booking confirmation to client:', error)
    return false
  }
}

/**
 * Улучшенное форматирование уведомления о новом бронировании для менеджеров
 */
export function formatBookingNotificationEnhanced(booking: any): string {
  const formattedDate = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const formattedEndTime = new Date(booking.end_time).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const duration = Math.round((new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60))

  // Получаем телефон из guest_phone или profile.phone
  const phoneNumber = booking.guest_phone || booking.profile?.phone || 'Не указан'

  // Получаем имя из guest_name или profile.name
  const clientName = booking.guest_name || booking.profile?.name || 'Не указано'

  // Получаем email если есть профиль
  const emailPart = booking.profile?.email ? `\n📧 <b>Email:</b> ${booking.profile.email}` : ''

  // Добавляем заметку если есть
  const notePart = booking.guest_note ? `\n💬 <b>Заметка:</b> ${booking.guest_note}` : ''

  // Форматируем ID безопасно - для менеджеров можно показать короткую версию
  const displayId = typeof booking.id === 'string' && booking.id.includes('-')
    ? booking.id.split('-')[0]
    : booking.id

  return `🔔 <b>НОВОЕ БРОНИРОВАНИЕ</b>

👤 <b>Клиент:</b> ${clientName}
📞 <b>Телефон:</b> ${phoneNumber}${emailPart}

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
⏰ <b>Время:</b> ${new Date(booking.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${formattedEndTime}
⏱️ <b>Продолжительность:</b> ${duration} ч.
💰 <b>Стоимость:</b> ${booking.price} ₽
💵 <b>Предоплата:</b> ${booking.prepayment || 0} ₽
👥 <b>Количество гостей:</b> ${booking.peoples || 1}${notePart}

🆔 <b>ID:</b> #${displayId}

⚡ <i>Требуется подтверждение</i>`
}

/**
 * Отправляет напоминание о предстоящем бронировании
 */
export async function sendBookingReminder(booking: any, hoursUntil: number): Promise<boolean> {
  if (!booking.profile?.telegram_id) {
    return false
  }

  const formattedDate = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const message = `⏰ <b>Напоминание о бронировании</b>

До вашего бронирования осталось ${hoursUntil} ч.!

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
👥 <b>Количество гостей:</b> ${booking.peoples || 1}

🎯 <i>Не забудьте подготовиться к поездке!</i>`

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
    console.error('Error sending booking reminder:', error)
    return false
  }
}

/**
 * Отправляет уведомление клиенту о подтверждении бронирования групповой поездки
 */
export async function sendGroupTripBookingConfirmation(booking: any): Promise<boolean> {
  // Проверяем наличие Telegram ID у клиента
  if (!booking.profile?.telegram_id) {
    console.log('Client has no telegram_id, skipping group trip confirmation')
    return false
  }

  const formattedDate = new Date(booking.group_trip.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const formattedEndTime = new Date(booking.group_trip.end_time).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const totalTickets = booking.adult_count + booking.child_count

  const message = `🚤 <b>Групповая поездка забронирована!</b>

Спасибо за бронирование! Ваши места на групповой поездке подтверждены.

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
⏰ <b>Время:</b> ${new Date(booking.group_trip.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${formattedEndTime}
👥 <b>Билеты:</b> ${booking.adult_count} взр. + ${booking.child_count} дет. = ${totalTickets} мест
💰 <b>Стоимость:</b> ${booking.total_price} ₽

✅ <i>Встретимся в назначенное время! Групповая поездка начнется точно по расписанию.</i>`

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      console.error('Telegram token not configured')
      return false
    }

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

    if (response.ok) {
      console.log(`✅ Sent group trip confirmation to client: ${booking.profile.telegram_id}`)
      return true
    } else {
      console.error(`❌ Failed to send group trip confirmation to client: ${booking.profile.telegram_id}`)
      return false
    }
  } catch (error) {
    console.error('Error sending group trip confirmation to client:', error)
    return false
  }
}

/**
 * Форматирует уведомление о новом бронировании групповой поездки для менеджеров
 */
export function formatGroupTripBookingNotification(booking: any): string {
  const formattedDate = new Date(booking.group_trip.start_time).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const formattedEndTime = new Date(booking.group_trip.end_time).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  })

  const totalTickets = booking.adult_count + booking.child_count

  // Получаем имя клиента
  const clientName = booking.guest_name || booking.profile?.name || 'Не указано'

  // Получаем телефон клиента
  const phoneNumber = booking.guest_phone || booking.profile?.phone || 'Не указан'

  // Получаем email если есть профиль
  const emailPart = booking.profile?.email ? `\n📧 <b>Email:</b> ${booking.profile.email}` : ''

  // Добавляем заметку если есть
  const notePart = booking.notes ? `\n💬 <b>Заметка:</b> ${booking.notes}` : ''

  return `🚤 <b>НОВОЕ БРОНИРОВАНИЕ ГРУППОВОЙ ПОЕЗДКИ</b>

👤 <b>Клиент:</b> ${clientName}
📞 <b>Телефон:</b> ${phoneNumber}${emailPart}

🚤 <b>Лодка:</b> ${booking.boat?.name || 'Не указано'}
📅 <b>Дата:</b> ${formattedDate}
⏰ <b>Время:</b> ${new Date(booking.group_trip.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${formattedEndTime}
👥 <b>Билеты:</b> ${booking.adult_count} взр. + ${booking.child_count} дет. = ${totalTickets} мест
💰 <b>Стоимость:</b> ${booking.total_price} ₽${notePart}

🎯 <b>Статус:</b> Подтверждено
📊 <b>Осталось мест:</b> ${booking.group_trip.available_seats - totalTickets}

✅ <i>Групповая поездка</i>`
}
