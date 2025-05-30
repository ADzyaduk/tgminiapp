import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import { formatBookingNotification, sendAdminNotification } from '~/server/utils/telegram-notifications'

export default defineEventHandler(async (event) => {
  try {
    console.log('🧪 Testing booking creation with notifications...')

    const supabase = await serverSupabaseClient(event)

    // Тестовые данные бронирования
    const testBooking = {
      boat_id: "874f57d8-82fa-4b88-96b8-cc5e8e1066d7", // Kiss
      guest_name: "Тест Уведомлений",
      guest_phone: "+7999123456",
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      total_price: 5000,
      status: 'pending'
    }

    console.log('📝 Creating test booking:', testBooking)

    // Создаем тестовое бронирование
    const { data: booking, error } = await (supabase as any)
      .from('bookings')
      .insert(testBooking)
      .select('*, boat:boat_id(name)')
      .single()

    if (error) {
      console.error('❌ Booking creation error:', error)
      return {
        success: false,
        error: 'Failed to create booking',
        details: error
      }
    }

    console.log('✅ Booking created:', booking?.id)

    // Проверяем отправку уведомлений
    if (booking) {
      try {
        console.log('📧 Starting notification process for booking:', booking.id)

        // Формируем текст уведомления
        const notificationMessage = formatBookingNotification(booking)
        console.log('📝 Notification message formatted')

        // Отправляем уведомление
        console.log('🚀 Calling sendAdminNotification...')

        const notificationResult = await sendAdminNotification(notificationMessage, {
          parseMode: 'HTML',
          boatId: booking.boat_id as string,
          bookingId: booking.id as string,
          event
        })

        console.log('✅ Notification result:', notificationResult)

        return {
          success: true,
          booking_id: booking.id,
          notification_sent: notificationResult,
          message: 'Test booking created and notification sent'
        }
      } catch (notifyError) {
        console.error('❌ Notification error:', notifyError)
        return {
          success: false,
          booking_id: booking.id,
          notification_sent: false,
          error: 'Booking created but notification failed',
          details: (notifyError as Error).message
        }
      }
    }

    return {
      success: false,
      error: 'No booking data returned'
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    return {
      success: false,
      error: 'Test failed',
      details: (error as Error).message
    }
  }
})
