import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { answerCallbackQuery, editMessageText } from '~/server/utils/telegram-client'

/**
 * API endpoint для обработки callback_query от inline кнопок Telegram
 * Этот endpoint должен быть настроен как webhook в Telegram Bot API
 * 
 * Telegram отправляет update в формате:
 * {
 *   "update_id": 123,
 *   "callback_query": { ... }
 * }
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Telegram отправляет update объект, проверяем наличие callback_query
    if (!body.callback_query) {
      // Если это не callback_query, возвращаем OK (может быть другой тип update)
      return { ok: true, message: 'Not a callback_query, ignoring' }
    }

    const callbackQuery = body.callback_query
    const { id: callbackQueryId, data, message, from } = callbackQuery

    if (!data || !message) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid callback_query data' }
    }

    console.log('🔔 Received callback_query:', { callbackQueryId, data, from: from?.id })

    // Парсим callback_data
    // Формат: booking_confirm_regular_<bookingId> или booking_cancel_regular_<bookingId>
    // bookingId может быть UUID с дефисами, поэтому используем более надежный парсинг
    const match = data.match(/^booking_(confirm|cancel)_(regular|group_trip)_(.+)$/)
    if (!match) {
      await answerCallbackQuery(callbackQueryId, '❌ Неизвестная команда', true)
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid callback_data format' }
    }

    const action = match[1] // confirm или cancel
    const bookingType = match[2] // regular или group_trip
    const bookingId = match[3] // bookingId (может содержать дефисы и другие символы)

    if (!['confirm', 'cancel'].includes(action) || !['regular', 'group_trip'].includes(bookingType)) {
      await answerCallbackQuery(callbackQueryId, '❌ Неверный формат команды', true)
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid action or booking type' }
    }

    const supabase = serverSupabaseServiceRole(event)

    // Получаем бронирование
    const tableName = bookingType === 'regular' ? 'bookings' : 'group_trip_bookings'
    const { data: booking, error: bookingError } = await supabase
      .from(tableName)
      .select('*, profile:profiles(*), boat:boats(*)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      await answerCallbackQuery(callbackQueryId, '❌ Бронирование не найдено', true)
      setResponseStatus(event, 404)
      return { success: false, error: 'Booking not found' }
    }

    // Проверяем текущий статус
    const currentStatus = booking.status
    if (currentStatus === 'confirmed' && action === 'confirm') {
      await answerCallbackQuery(callbackQueryId, '✅ Бронирование уже подтверждено', false)
      return { success: true, message: 'Already confirmed' }
    }

    if (currentStatus === 'cancelled' && action === 'cancel') {
      await answerCallbackQuery(callbackQueryId, '❌ Бронирование уже отменено', false)
      return { success: true, message: 'Already cancelled' }
    }

    // Обновляем статус бронирования
    const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ status: newStatus })
      .eq('id', bookingId)

    if (updateError) {
      console.error('❌ Error updating booking status:', updateError)
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка при обновлении статуса', true)
      setResponseStatus(event, 500)
      return { success: false, error: 'Failed to update booking status' }
    }

    // Отправляем уведомление клиенту
    try {
      if (booking.profile?.telegram_id) {
        const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications')
        const bookingWithDetails = {
          ...booking,
          status: newStatus
        }
        await sendClientStatusNotification(bookingWithDetails, newStatus, from?.first_name || 'Менеджер')
      }
    } catch (notifyError) {
      console.error('Failed to send client notification:', notifyError)
    }

    // Обновляем сообщение в Telegram, убирая кнопки и показывая новый статус
    const statusEmoji = action === 'confirm' ? '✅' : '❌'
    const statusText = action === 'confirm' ? 'ПОДТВЕРЖЕНО' : 'ОТМЕНЕНО'
    const updatedText = `${message.text}\n\n${statusEmoji} <b>Статус изменен: ${statusText}</b>\n👤 <i>Изменил: ${from?.first_name || 'Менеджер'}</i>`

    try {
      await editMessageText(
        message.chat.id,
        message.message_id,
        updatedText,
        {
          parseMode: 'HTML',
          replyMarkup: undefined // Убираем кнопки
        }
      )
    } catch (editError) {
      console.error('Failed to edit message:', editError)
    }

    // Отвечаем на callback
    const successMessage = action === 'confirm' ? '✅ Бронирование подтверждено' : '❌ Бронирование отменено'
    await answerCallbackQuery(callbackQueryId, successMessage, false)

    console.log(`✅ Booking ${bookingId} ${action === 'confirm' ? 'confirmed' : 'cancelled'} by ${from?.id}`)

    return {
      success: true,
      bookingId,
      action,
      newStatus
    }

  } catch (error: any) {
    console.error('❌ Callback query error:', error)
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error.message || 'Internal server error'
    }
  }
})

