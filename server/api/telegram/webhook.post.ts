import { defineEventHandler, readBody } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/supabase'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

// NOTE: The type below is enhanced to include fields that are used in the code but seem
// to be missing from the auto-generated `types/supabase.ts`. This suggests the types file
// might be out of sync with the actual database schema. Regenerating the types is recommended.
type BookingWithDetails = Tables<'bookings'> & {
  profile: (Tables<'profiles'> & { username?: string; first_name?: string; last_name?: string }) | null
  boat: Tables<'boats'> | null
  date?: string
  time?: string
  duration?: number
  people_count?: number
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
  // Выполняем "в фоне", не дожидаясь ответа, чтобы не блокировать основной поток
  sendTelegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || '',
  }).catch(e => console.error('Failed to answer callback query in background:', e));
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
    return;
  }
  const url = `https://api.telegram.org/bot${token}/${method}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`❌ Telegram API error for method '${method}': ${response.status} ${response.statusText}`, await response.text());
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Network error calling Telegram API method '${method}':`, error);
    throw error;
  }
}

// #endregion

// #region Main Handler
export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await readBody(event);

    if (!body.callback_query) {
      return { statusCode: 200, statusMessage: 'OK (not a callback query)' };
    }

    const { callback_query } = body;
    const { id: callbackQueryId, data: callbackData, message, from } = callback_query;

    // Немедленно отвечаем Telegram, чтобы кнопка перестала "грузиться"
    await answerCallbackQuery(callbackQueryId);

    const [bookingType, action, bookingId] = callbackData.split(':');

    if (!bookingType || !action || !bookingId) {
      console.error('❌ Invalid callback data format:', callbackData);
      return { statusCode: 400, statusMessage: 'Invalid callback_data format.' };
    }

    // Пока поддерживаем только 'regular'
    if (bookingType === 'regular') {
      await handleRegularBooking(event, {
        bookingId,
        action,
        managerChatId: message.chat.id.toString(),
        messageId: message.message_id.toString(),
        managerTelegramId: from.id.toString(),
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
  managerChatId: string;
  messageId: string;
  managerTelegramId: string;
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

  // 5. Обновляем сообщение у менеджера (убираем кнопки, пишем статус)
  await updateManagerMessage(ctx, newStatus, booking);

  // 6. Уведомляем клиента
  const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications');
  await sendClientStatusNotification(booking, newStatus);
}

/**
 * Обновляет сообщение менеджера, форматируя его с новым статусом.
 */
async function updateManagerMessage(ctx: BookingContext, status: string, booking?: any) {
  const statusMap: Record<string, { text: string; emoji: string }> = {
    confirmed: { text: 'ПОДТВЕРЖДЕНО', emoji: '✅' },
    cancelled: { text: 'ОТМЕНЕНО', emoji: '❌' },
    pending: { text: 'ОЖИДАЕТ', emoji: '⏳' },
    not_found: { text: 'НЕ НАЙДЕНО', emoji: '❓' },
  };

  const { text: statusText, emoji } = statusMap[status] || { text: status.toUpperCase(), emoji: '⚠️' };

  let messageBody: string;
  if (booking) {
    const clientName = (booking.profile?.first_name || '') + ' ' + (booking.profile?.last_name || '');
    const clientTelegram = booking.profile?.username ? `@${booking.profile.username}` : 'N/A';
    messageBody = [
        `🛥️ <b>Лодка:</b> ${booking.boat?.name || 'Неизвестно'}`,
        `👤 <b>Клиент:</b> ${clientName.trim() || 'Имя не указано'}`,
        `📞 <b>Telegram:</b> ${clientTelegram}`,
        `📅 <b>Дата:</b> ${booking.date}`,
        `⏰ <b>Время:</b> ${booking.time}`,
        `⏳ <b>Длительность:</b> ${booking.duration} ч.`,
        `👥 <b>Кол-во человек:</b> ${booking.people_count}`,
    ].join('\n');
  } else {
    messageBody = `Бронирование с ID: ${ctx.bookingId} не найдено в системе.`;
  }

  const fullMessage = `${emoji} <b>БРОНИРОВАНИЕ ${statusText}</b> ${emoji}\n\n${messageBody}`;

  await sendTelegramRequest('editMessageText', {
    chat_id: ctx.managerChatId,
    message_id: parseInt(ctx.messageId, 10),
    text: fullMessage,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [] }, // Убираем кнопки
  });
}
// #endregion
