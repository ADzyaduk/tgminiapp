import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import { sendBookingReminder } from '~/server/utils/telegram-notifications'

/**
 * API для отправки напоминаний о предстоящих бронированиях
 * Этот endpoint может вызываться по cron-расписанию
 */
export default defineEventHandler(async (event) => {
  try {
    const { hours = 24 } = await readBody(event) // По умолчанию за 24 часа

    const supabase = await serverSupabaseClient(event)

    // Получаем подтвержденные бронирования, которые начинаются через указанное количество часов
    const targetTime = new Date()
    targetTime.setHours(targetTime.getHours() + hours)

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(*), boat:boat_id(name)')
      .eq('status', 'confirmed')
      .gte('start_time', new Date().toISOString())
      .lte('start_time', targetTime.toISOString())
      .not('profile.telegram_id', 'is', null)

    if (error) {
      console.error('Error fetching bookings for reminders:', error)
      return { status: 500, body: { error: 'Failed to fetch bookings' } }
    }

    if (!bookings || bookings.length === 0) {
      return { status: 200, body: { message: 'No bookings found for reminders', sent: 0 } }
    }

    // Отправляем напоминания
    let successCount = 0
    const results = await Promise.allSettled(
      bookings.map(async (booking: any) => {
        try {
          const hoursUntil = Math.round((new Date(booking.start_time).getTime() - new Date().getTime()) / (1000 * 60 * 60))
          const success = await sendBookingReminder(booking, hoursUntil)
          if (success) successCount++
          return { bookingId: booking.id, success }
        } catch (error) {
          console.error(`Failed to send reminder for booking ${booking.id}:`, error)
          return { bookingId: booking.id, success: false, error }
        }
      })
    )

    console.log(`📅 Sent ${successCount} reminders out of ${bookings.length} bookings`)

    return {
      status: 200,
      body: {
        message: `Sent ${successCount} reminders`,
        total: bookings.length,
        sent: successCount,
        results: results.map(result =>
          result.status === 'fulfilled' ? result.value : { error: result.reason }
        )
      }
    }
  } catch (error) {
    console.error('Error in reminders endpoint:', error)
    return { status: 500, body: { error: 'Internal server error' } }
  }
})

/**
 * Автоматическая отправка напоминаний
 * Вызывается по CRON или вручную
 */
export async function sendAutomaticReminders() {
  try {
    const supabase = await serverSupabaseClient({} as any)

    // Напоминания за 24 часа
    const tomorrow = new Date()
    tomorrow.setHours(tomorrow.getHours() + 24)

    // Напоминания за 2 часа
    const in2Hours = new Date()
    in2Hours.setHours(in2Hours.getHours() + 2)

    const timeRanges = [
      { hours: 24, label: '24 часа' },
      { hours: 2, label: '2 часа' }
    ]

    for (const range of timeRanges) {
      const targetTime = new Date()
      targetTime.setHours(targetTime.getHours() + range.hours)

      const startTime = new Date(targetTime.getTime() - 30 * 60 * 1000) // 30 минут назад
      const endTime = new Date(targetTime.getTime() + 30 * 60 * 1000)   // 30 минут вперед

      const { data: bookings } = await supabase
        .from('bookings')
        .select('*, profile:user_id(*), boat:boat_id(name)')
        .eq('status', 'confirmed')
        .gte('start_time', startTime.toISOString())
        .lte('start_time', endTime.toISOString())
        .not('profile.telegram_id', 'is', null)

      if (bookings && bookings.length > 0) {
        console.log(`📅 Sending ${range.label} reminders for ${bookings.length} bookings`)

        for (const booking of bookings) {
          try {
            await sendBookingReminder(booking, range.hours)
          } catch (error) {
            console.error(`Failed to send ${range.label} reminder for booking ${(booking as any).id}:`, error)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in automatic reminders:', error)
  }
}
