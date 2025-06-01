import { defineEventHandler } from 'h3'
import { sendAutomaticReminders } from '../telegram/reminders.post'

/**
 * CRON endpoint для автоматической отправки напоминаний
 * Должен вызываться каждый час
 *
 * Отправляет напоминания:
 * - За 24 часа до бронирования
 * - За 2 часа до бронирования
 */
export default defineEventHandler(async (event) => {
  try {
    console.log('🕐 Starting automatic reminders CRON job...')

    await sendAutomaticReminders()

    console.log('✅ Automatic reminders CRON job completed')

    return {
      status: 200,
      body: {
        message: 'Automatic reminders sent successfully',
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('❌ Error in automatic reminders CRON job:', error)

    return {
      status: 500,
      body: {
        error: 'Failed to send automatic reminders',
        timestamp: new Date().toISOString()
      }
    }
  }
})
