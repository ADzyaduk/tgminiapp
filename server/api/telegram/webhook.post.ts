import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/supabase'

type Booking = Database['public']['Tables']['bookings']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Boat = Database['public']['Tables']['boats']['Row']

// Расширенный тип для бронирования с вложенными данными
type BookingWithDetails = Booking & {
  profile: Profile | null
  boat: Boat | null
}

/**
 * ВРЕМЕННЫЙ ОТЛАДОЧНЫЙ ОБРАБОТЧИК ДЛЯ ДИАГНОСТИКИ ПРОБЛЕМ С API TELEGRAM
 *
 * Этот код полностью заменяет стандартную логику для проверки трех основных действий:
 * 1. answerCallbackQuery - убирает "загрузку" с кнопки.
 * 2. editMessageText - редактирует сообщение, убирая кнопки.
 * 3. sendMessage - отправляет новое сообщение.
 *
 * Он не использует базу данных и никак не влияет на статусы бронирований.
 */

// #region Telegram API Helpers
// Эти функции инкапсулируют прямые вызовы к API Telegram

/**
 * Отвечает на нажатие кнопки в Telegram. Это убирает "часики" на кнопке.
 * @param callbackQueryId ID нажатия на кнопку
 * @param text Необязательный текст для уведомления пользователя
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  // Выполняем синхронно, чтобы убедиться что ответ дошел
  try {
    await sendTelegramRequest('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text || '',
      show_alert: false // Показывать как всплывающее уведомление или нет
    });
    console.log(`✅ Answered callback query: ${callbackQueryId}`);
  } catch (error) {
    console.error('❌ Failed to answer callback query:', error);
  }
}

/**
 * Универсальная функция для отправки запросов к Telegram Bot API.
 * @param method Метод API (например, 'editMessageText')
 * @param body Тело запроса
 */
async function sendTelegramRequest(method: string, body: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error(`❌ TELEGRAM_BOT_TOKEN is not set. Cannot call method '${method}'.`);
    return null;
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;

  try {
    console.log(`📡 Calling Telegram API: ${method}`, JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Telegram API error for method '${method}': ${response.status} ${response.statusText}`, result);
      return null;
    }

    console.log(`✅ Telegram API success for method '${method}':`, result);
    return result;
  } catch (error) {
    console.error(`❌ Network error calling Telegram API method '${method}':`, error);
    return null;
  }
}

// #endregion

// #region Main Handler
export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await readBody(event);

    console.log('🔔 Webhook received:', JSON.stringify(body, null, 2));

    if (!body.callback_query) {
      console.log('ℹ️ Not a callback query, ignoring');
      return { statusCode: 200, statusMessage: 'OK (not a callback query)' };
    }

    const { callback_query } = body;
    const { id: callbackQueryId, data: callbackData, message, from } = callback_query;

    console.log(`📱 Received callback query: ${callbackData} from user ${from.id}`);
    console.log(`📨 Message details:`, {
      chat_id: message?.chat?.id,
      message_id: message?.message_id,
      text: message?.text?.substring(0, 100)
    });

    // КРИТИЧЕСКИ ВАЖНО: Немедленно отвечаем на callback query
    await answerCallbackQuery(callbackQueryId, '⏳ Обрабатываем...');

    // Парсим callback_data в формате: bookingType:action:bookingId
    const parts = callbackData.split(':');
    
    if (parts.length < 3) {
      console.error('❌ Invalid callback data format:', callbackData);
      console.error('   Expected format: bookingType:action:bookingId');
      console.error('   Received parts:', parts);
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка: неверный формат данных');
      return { statusCode: 400, statusMessage: 'Invalid callback_data format.' };
    }

    const [bookingType, action, ...bookingIdParts] = parts;
    const bookingId = bookingIdParts.join(':'); // На случай если bookingId содержит ':'

    if (!bookingType || !action || !bookingId) {
      console.error('❌ Invalid callback data format:', callbackData);
      console.error('   bookingType:', bookingType, 'action:', action, 'bookingId:', bookingId);
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка: неверный формат данных');
      return { statusCode: 400, statusMessage: 'Invalid callback_data format.' };
    }

    console.log(`🔄 Processing ${action} for ${bookingType} booking ${bookingId}`);
    console.log(`   Callback data: ${callbackData} (${new TextEncoder().encode(callbackData).length} bytes)`);

    // Пока поддерживаем только 'regular'
    if (bookingType === 'regular') {
      await handleRegularBooking(event, {
        bookingId,
        action,
        managerChatId: message.chat.id,
        messageId: message.message_id,
        managerTelegramId: from.id,
        callbackQueryId,
      });
    } else {
      console.warn(`⚠️ Unsupported booking type: ${bookingType}`);
    }

    return { statusCode: 200, statusMessage: 'OK' };
  } catch (error) {
    console.error('❌ Unhandled error in webhook handler:', error);
    return { statusCode: 500, statusMessage: 'Internal Server Error' };
  }
});
// #endregion

// #region Booking Logic
interface BookingContext {
  bookingId: string;
  action: 'confirm' | 'cancel' | string;
  managerChatId: number;
  messageId: number;
  managerTelegramId: number;
  callbackQueryId: string;
}

async function handleRegularBooking(event: H3Event, ctx: BookingContext) {
  const supabase = serverSupabaseServiceRole<Database>(event);

  // 1. Получаем бронирование со всеми деталями
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*, profile:profiles(*), boat:boats(*)')
    .eq('id', ctx.bookingId)
    .single();

  if (fetchError || !booking) {
    console.error(`🚨 Booking not found or fetch error for ID ${ctx.bookingId}:`, fetchError);
    await answerCallbackQuery(ctx.callbackQueryId, '🚨 Ошибка: бронирование не найдено!');
    // Можно дополнительно обновить сообщение, сказав что бронь не найдена
    await updateManagerMessage(ctx, 'not_found');
    return;
  }

  // 2. Проверяем, не было ли бронирование уже обработано
  if (booking.status !== 'pending') {
    await answerCallbackQuery(ctx.callbackQueryId, `Это бронирование уже обработано (статус: ${booking.status}).`);
    // Обновляем сообщение на случай, если там все еще есть кнопки
    await updateManagerMessage(ctx, booking.status, booking);
    return;
  }

  // 3. Проверяем права (пока заглушка)
  // const hasPermission = await checkUserPermissions(supabase, ctx.managerTelegramId, booking);
  // if (!hasPermission) {
  //   await answerCallbackQuery(ctx.callbackQueryId, 'У вас нет прав для этого действия.');
  //   return;
  // }

  // 4. Обновляем статус
  const newStatus = ctx.action === 'confirm' ? 'confirmed' : 'cancelled';
  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', ctx.bookingId);

  if (updateError) {
    console.error(`🚨 DB update error for booking ${ctx.bookingId}:`, updateError);
    await answerCallbackQuery(ctx.callbackQueryId, '🚨 Ошибка базы данных при обновлении статуса!');
    return;
  }

  console.log(`✅ Successfully updated booking ${ctx.bookingId} to ${newStatus}`);

  // 5. Отвечаем на callback query с подтверждением действия
  const actionText = ctx.action === 'confirm' ? 'подтверждено' : 'отменено';
  await answerCallbackQuery(ctx.callbackQueryId, `✅ Бронирование успешно ${actionText}!`);

  // 6. Обновляем сообщение у менеджера (убираем кнопки, пишем статус)
  await updateManagerMessage(ctx, newStatus, booking);

  // 7. Уведомляем клиента
  const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications');
  await sendClientStatusNotification(booking as any, newStatus);
}

/**
 * Обновляет сообщение менеджера, форматируя его с новым статусом.
 */
async function updateManagerMessage(ctx: BookingContext, status: string, booking?: BookingWithDetails) {
  const statusMap: Record<string, { text: string; emoji: string }> = {
    confirmed: { text: 'ПОДТВЕРЖДЕНО', emoji: '✅' },
    cancelled: { text: 'ОТМЕНЕНО', emoji: '❌' },
    pending: { text: 'ОЖИДАЕТ', emoji: '⏳' },
    not_found: { text: 'НЕ НАЙДЕНО', emoji: '❓' },
  };

  const { text: statusText, emoji } = statusMap[status] || { text: status.toUpperCase(), emoji: '⚠️' };

  let messageBody: string;
  if (booking) {
    const clientName = booking.profile?.name || booking.guest_name || 'Имя не указано';
    // В профиле нет `username`, используем `telegram_id` если он есть, иначе телефон
    const clientTelegram = booking.profile?.telegram_id || booking.guest_phone || 'N/A';

    // Форматируем дату и время из start_time и end_time
    const date = new Date(booking.start_time).toLocaleDateString('ru-RU');
    const time = `${new Date(booking.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${new Date(booking.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

    messageBody = [
        `🛥️ <b>Лодка:</b> ${booking.boat?.name || 'Неизвестно'}`,
        `👤 <b>Клиент:</b> ${clientName.trim()}`,
        `📞 <b>Контакт:</b> ${clientTelegram}`,
        `📅 <b>Дата:</b> ${date}`,
        `⏰ <b>Время:</b> ${time}`,
        `⏳ <b>Длительность:</b> ${booking.pph || 'N/A'} ч.`,
        `👥 <b>Кол-во человек:</b> ${booking.peoples || 'N/A'}`,
    ].join('\n');
  } else {
    messageBody = `Бронирование с ID: ${ctx.bookingId} не найдено в системе.`;
  }

  const fullMessage = `${emoji} <b>БРОНИРОВАНИЕ ${statusText}</b> ${emoji}\n\n${messageBody}`;

  console.log(`📝 Updating message for manager ${ctx.managerChatId}, message ${ctx.messageId}`);
  console.log(`📄 New message text: ${fullMessage.substring(0, 100)}...`);

  try {
    await sendTelegramRequest('editMessageText', {
      chat_id: ctx.managerChatId,
      message_id: ctx.messageId,
      text: fullMessage,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }, // Убираем кнопки
    });
    console.log(`✅ Successfully updated manager message`);
  } catch (error) {
    console.error(`❌ Failed to update manager message:`, error);
  }
}
// #endregion
