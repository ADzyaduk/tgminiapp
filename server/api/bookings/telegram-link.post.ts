import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import { formatBookingNotification, sendAdminNotification } from '~/server/utils/telegram-notifications'

/**
 * API для создания бронирования с автоматической связкой Telegram пользователя
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { telegram_user, booking_data } = body

    const supabase = await serverSupabaseClient(event)

    let linkedUserId = null

    // Если передан telegram_user, ищем или создаем пользователя
    if (telegram_user && telegram_user.id) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('telegram_id', telegram_user.id.toString())
        .single()

      if (existingUser) {
        linkedUserId = existingUser.id
      } else {
        // Создаем нового telegram-only пользователя
        const { data: newUser, error: createError } = await supabase
          .from('profiles')
          .insert({
            telegram_id: telegram_user.id.toString(),
            name: `${telegram_user.first_name || ''} ${telegram_user.last_name || ''}`.trim() ||
                  telegram_user.username || 'Telegram User',
            email: telegram_user.username ?
                   `${telegram_user.username}@telegram.local` :
                   `telegram_${telegram_user.id}@local`,
            role: 'telegram_only'
          })
          .select('id')
          .single()

        if (!createError && newUser) {
          linkedUserId = newUser.id
        }
      }
    }

    // Создаем бронирование
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        ...booking_data,
        user_id: linkedUserId, // Связываем с telegram пользователем
        status: 'pending'
      })
      .select('*, profile:user_id(*), boat:boat_id(name)')
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      return {
        status: 500,
        body: { error: 'Failed to create booking' }
      }
    }

    // Отправляем уведомление
    if (booking) {
      try {
        const notificationMessage = formatBookingNotification(booking)
        await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: booking.boat_id as string,
          bookingId: booking.id as string,
          event
        })

        // Также отправляем подтверждение клиенту если у него есть telegram_id
        if (linkedUserId && telegram_user?.id) {
          const clientMessage = `✅ <b>Бронирование создано!</b>

ID: ${booking.id}
Лодка: ${booking.boat?.name || 'Не указано'}
Статус: <b>ожидает подтверждения</b>

📞 Мы свяжемся с вами для подтверждения.
🔔 Уведомления о статусе будут приходить в этот чат.`

          // Отправляем клиенту
          const token = process.env.TELEGRAM_BOT_TOKEN
          if (token) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: telegram_user.id,
                text: clientMessage,
                parse_mode: 'HTML'
              })
            })
          }
        }
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError)
      }
    }

    return {
      status: 201,
      body: {
        ...booking,
        telegram_linked: !!linkedUserId
      }
    }
  } catch (error) {
    console.error('Error in telegram booking:', error)
    return {
      status: 500,
      body: { error: 'Internal server error' }
    }
  }
})
