import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

/**
 * API для отправки напоминаний о предстоящих бронированиях
 * Этот endpoint может вызываться по cron-расписанию
 */
export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    // Получаем все подтвержденные бронирования на завтра
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const startOfDay = new Date(tomorrow)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(tomorrow)
    endOfDay.setHours(23, 59, 59, 999)

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(*)')
      .eq('status', 'confirmed')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .not('profile.telegram_id', 'is', null)

    if (error) {
      console.error('Error fetching bookings for reminders:', error)
      return { status: 500, body: { error: 'Failed to fetch bookings' } }
    }

    if (!bookings || bookings.length === 0) {
      return { status: 200, body: { message: 'No bookings to remind about' } }
    }

    const token = process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      return { status: 500, body: { error: 'Telegram token not configured' } }
    }

    // Отправляем напоминания каждому клиенту
    const results = await Promise.all(
      bookings.map(async (booking: any) => {
        try {
          const startTime = new Date(booking.start_time)
          const formattedTime = startTime.toLocaleDateString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'long'
          })

          const message = `🔔 <b>Напоминание о бронировании</b>

🛥️ Лодка: <b>${booking.boat?.name || 'Не указано'}</b>
📅 Завтра, ${formattedTime}
💰 Цена: ${booking.price} ₽

📍 Не забудьте прийти вовремя!
📞 При необходимости свяжитесь с нами через приложение.

Хорошего отдыха! 🌊`

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

          return {
            bookingId: booking.id,
            success: response.ok,
            userId: booking.profile.id
          }
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking.id}:`, error)
          return {
            bookingId: booking.id,
            success: false,
            error: error
          }
        }
      })
    )

    // Логируем результаты
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`Reminders sent: ${successCount} success, ${failCount} failed`)

    return {
      status: 200,
      body: {
        message: `Sent ${successCount} reminders, ${failCount} failed`,
        results
      }
    }
  } catch (error) {
    console.error('Error in reminders endpoint:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})
