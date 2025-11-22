import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'
import type { Database } from '~/types/supabase'
import { addLog } from '~/server/utils/telegram-logs'

type Booking = Database['public']['Tables']['bookings']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']
type Boat = Database['public']['Tables']['boats']['Row']

// Расширенный тип для бронирования с вложенными данными
type BookingWithDetails = Booking & {
  profile: Profile | null
  boat: Boat | null
}

/**
 * Основной обработчик Webhook для Telegram API
 * 
 * Обрабатывает:
 * 1. Callback Query (нажатия на кнопки) - подтверждение/отмена бронирований
 * 2. Текстовые сообщения - команды (/admin, /start и др.)
 */

// #region Telegram API Helpers
// Эти функции инкапсулируют прямые вызовы к API Telegram

/**
 * Отвечает на нажатие кнопки в Telegram. Это убирает "часики" на кнопке.
 * @param callbackQueryId ID нажатия на кнопку
 * @param text Необязательный текст для уведомления пользователя
 * @param showAlert Показывать ли как всплывающее уведомление (по умолчанию false)
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<boolean> {
  // Выполняем синхронно, чтобы убедиться что ответ дошел
  try {
    const result = await sendTelegramRequest('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: text || '',
      show_alert: showAlert
    });
    const success = result !== null && result.ok !== false;
    if (success) {
      console.log(`✅ Answered callback query: ${callbackQueryId}${text ? ` with text: ${text}` : ''}`);
    } else {
      console.error(`❌ Failed to answer callback query: ${callbackQueryId}`, result);
    }
    return success;
  } catch (error) {
    console.error('❌ Failed to answer callback query:', error);
    return false;
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

// #region Message Handler
async function handleMessage(event: H3Event, body: any) {
  try {
    const { message } = body;
    const { chat, text, from } = message;

    if (!text) {
      return { ok: true, message: 'No text in message' };
    }

    addLog('info', `Message received: ${text.substring(0, 50)}`, { userId: from.id, chatId: chat.id });

    // Используем serverSupabaseServiceRole для проверки прав администратора
    const supabase = serverSupabaseServiceRole<Database>(event);

    // Обработка админ-команд
    if (text.startsWith('/admin')) {
      const adminCommands = await import('~/server/api/telegram/admin-commands.post');
      
      // Проверяем права администратора
      const { data: adminUser } = await supabase
        .from('profiles')
        .select('id, role, name')
        .eq('telegram_id', from.id.toString())
        .eq('role', 'admin')
        .single();

      if (!adminUser) {
        await adminCommands.sendMessage(chat.id, '❌ У вас нет прав администратора');
        return { ok: true };
      }

      const command = text.split(' ')[0].toLowerCase();
      const args = text.split(' ').slice(1);

      switch (command) {
        case '/admin':
          return await adminCommands.handleAdminMenu(chat.id);
        case '/adminstats':
          return await adminCommands.handleAdminStats(chat.id, supabase);
        case '/admintoday':
          return await adminCommands.handleTodayBookings(chat.id, supabase);
        case '/adminremind':
          return await adminCommands.handleSendReminders(chat.id, event);
        case '/adminlogs':
          return await adminCommands.handleAdminLogs(chat.id, args);
        default:
          await adminCommands.sendMessage(chat.id, '❓ Неизвестная команда администратора. Используйте /admin для просмотра доступных команд.');
          return { ok: true };
      }
    }

    // Обработка обычных команд
    const { 
      handleStartCommand, 
      handleHelpCommand, 
      handleMyBookingsCommand, 
      handleStatusCommand, 
      sendMessage 
    } = await import('~/server/utils/telegram-bot-commands');
    
    if (text.startsWith('/start')) {
      return await handleStartCommand(chat.id, from, supabase);
    }

    if (text.startsWith('/help')) {
      return await handleHelpCommand(chat.id);
    }

    if (text.startsWith('/mybookings')) {
      return await handleMyBookingsCommand(chat.id, from, supabase);
    }

    if (text.startsWith('/status')) {
      return await handleStatusCommand(chat.id, from, supabase);
    }

    // Для остальных команд отправляем стандартное сообщение
    await sendMessage(chat.id, '👋 Привет! Используйте /start для открытия приложения.');

    return { ok: true };
  } catch (error: any) {
    console.error('❌ Error handling message:', error);
    addLog('error', 'Error handling message', { error: error.message });
    return { ok: false, error: 'Error handling message' };
  }
}
// #endregion

// #region Callback Query Handler
async function handleCallbackQuery(event: H3Event, body: any) {
  try {
    const { callback_query } = body;
    const { id: callbackQueryId, data: callbackData, message, from } = callback_query;

    console.log(`📱 Received callback query: ${callbackData} from user ${from.id}`);
    addLog('info', `Callback query: ${callbackData}`, { userId: from.id, chatId: message?.chat?.id });
    console.log(`📨 Message details:`, {
      chat_id: message?.chat?.id,
      message_id: message?.message_id,
      text: message?.text?.substring(0, 100)
    });

    // Парсим callback_data в формате: bookingType:action:bookingId
    const parts = callbackData.split(':');
    
    if (parts.length < 3) {
      console.error('❌ Invalid callback data format:', callbackData);
      addLog('error', 'Invalid callback data format', { callbackData, parts });
      console.error('   Expected format: bookingType:action:bookingId');
      console.error('   Received parts:', parts);
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка: неверный формат данных', true);
      return { ok: true };
    }

    const [bookingType, action, ...bookingIdParts] = parts;
    let bookingId = bookingIdParts.join(':'); // На случай если bookingId содержит ':'
    bookingId = bookingId.trim(); // Убираем пробелы если есть

    if (!bookingType || !action || !bookingId) {
      console.error('❌ Invalid callback data format (missing parts):', callbackData);
      console.error(`   bookingType: '${bookingType}', action: '${action}', bookingId: '${bookingId}'`);
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка: неверный формат данных', true);
      return { ok: true };
    }

    // Проверяем формат bookingId (должен быть UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      console.error('❌ Invalid booking ID format:', bookingId);
      console.error(`   Callback Data: ${callbackData}`);
      console.error(`   Parsed ID length: ${bookingId.length}`);
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка: неверный ID бронирования', true);
      return { ok: true };
    }

    // Проверяем валидность action
    if (action !== 'confirm' && action !== 'cancel') {
      console.error('❌ Invalid action:', action);
      await answerCallbackQuery(callbackQueryId, '❌ Ошибка: неверное действие', true);
      return { ok: true };
    }

    console.log(`🔄 Processing ${action} for ${bookingType} booking ${bookingId}`);
    console.log(`   Callback data: ${callbackData} (${new TextEncoder().encode(callbackData).length} bytes)`);
    console.log(`   Manager Telegram ID: ${from.id}`);
    console.log(`   Chat ID: ${message.chat.id}, Message ID: ${message.message_id}`);

    // КРИТИЧЕСКИ ВАЖНО: Отвечаем на callback_query СРАЗУ, чтобы убрать "часики" с кнопки
    // Telegram требует ответ в течение нескольких секунд, иначе покажет ошибку
    // Отвечаем БЕЗ текста сначала, чтобы убрать индикатор загрузки
    const answerResult = await answerCallbackQuery(callbackQueryId, '', false);
    console.log(`   Callback query answered:`, answerResult ? 'success' : 'failed');
    
    if (!answerResult) {
      console.error(`❌ Failed to answer callback query - Telegram may show error to user`);
      // Продолжаем обработку даже если ответ не отправился
    }

    // Обрабатываем в зависимости от типа бронирования
    if (bookingType === 'regular') {
      await handleRegularBooking(event, {
        bookingId,
        action,
        managerChatId: message.chat.id,
        messageId: message.message_id,
        managerTelegramId: from.id,
        callbackQueryId,
      });
    } else if (bookingType === 'group_trip') {
      await handleGroupTripBooking(event, {
        bookingId,
        action,
        managerChatId: message.chat.id,
        messageId: message.message_id,
        managerTelegramId: from.id,
        callbackQueryId,
      });
    } else {
      console.warn(`⚠️ Unsupported booking type: ${bookingType}`);
      await answerCallbackQuery(callbackQueryId, '❌ Неподдерживаемый тип бронирования', true);
      return { ok: true };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('❌ Error handling callback query:', error);
    addLog('error', 'Error handling callback query', { error: error.message, stack: error.stack });
    // Всё равно возвращаем ok: true для Telegram
    return { ok: true };
  }
}
// #endregion

// #region Main Handler
export default defineEventHandler(async (event: H3Event) => {
  try {
    const body = await readBody(event);

    console.log('🔔 Webhook received:', JSON.stringify(body, null, 2));
    addLog('info', 'Webhook received', { hasCallbackQuery: !!body.callback_query, hasMessage: !!body.message });

    // Обрабатываем callback_query
    if (body.callback_query) {
      const result = await handleCallbackQuery(event, body);
      // ВАЖНО: Всегда возвращаем 200 OK для Telegram, иначе webhook перестанет работать
      setResponseStatus(event, 200);
      return result;
    }

    // Обрабатываем обычные сообщения (команды)
    if (body.message) {
      const result = await handleMessage(event, body);
      setResponseStatus(event, 200);
      return result;
    }

    // Если ни callback_query, ни message - возвращаем OK
    console.log('ℹ️ Webhook received but no callback_query or message');
    setResponseStatus(event, 200);
    return { ok: true, message: 'No callback_query or message' };
  } catch (error: any) {
    console.error('❌ Unhandled error in webhook handler:', error);
    addLog('error', 'Unhandled error in webhook', { error: error.message, stack: error.stack });
    
    // КРИТИЧЕСКИ ВАЖНО: Всегда возвращаем 200 OK для Telegram
    // Иначе Telegram решит что webhook не работает и перестанет отправлять обновления
    setResponseStatus(event, 200);
    return { ok: true, error: 'Internal error handled' };
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

  console.log(`🔍 Fetching booking with ID: ${ctx.bookingId}`);
  
  // 1. Получаем бронирование со всеми деталями
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*, profile:profiles(*), boat:boats(*)')
    .eq('id', ctx.bookingId)
    .single();

  if (fetchError || !booking) {
    console.error(`🚨 Booking not found or fetch error for ID ${ctx.bookingId}:`, fetchError);
    console.error(`   Error details:`, JSON.stringify(fetchError, null, 2));
    // Обновляем сообщение с ошибкой (callback_query уже отвечен в начале)
    await updateManagerMessage(ctx, 'not_found');
    return;
  }

  console.log(`✅ Booking found: ${booking.id}, current status: ${booking.status}`);

  // 2. Проверяем, не было ли бронирование уже обработано
  if (booking.status !== 'pending') {
    // Обновляем сообщение на случай, если там все еще есть кнопки
    // callback_query уже отвечен в начале, поэтому просто обновляем сообщение
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
  console.log(`🔄 Updating booking ${ctx.bookingId} status from ${booking.status} to ${newStatus}`);
  
  const { data: updatedBooking, error: updateError } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', ctx.bookingId)
    .select('*, profile:profiles(*), boat:boats(*)')
    .single();

  if (updateError) {
    console.error(`🚨 DB update error for booking ${ctx.bookingId}:`, updateError);
    addLog('error', `DB update error for booking ${ctx.bookingId}`, { bookingId: ctx.bookingId, error: updateError });
    console.error(`   Error details:`, JSON.stringify(updateError, null, 2));
    // Обновляем сообщение с ошибкой (callback_query уже отвечен в начале)
    await updateManagerMessage(ctx, 'error', booking);
    return;
  }

  if (!updatedBooking) {
    console.error(`🚨 Booking ${ctx.bookingId} not found after update`);
    await updateManagerMessage(ctx, 'error', booking);
    return;
  }

  console.log(`✅ Successfully updated booking ${ctx.bookingId} to ${newStatus}`);
  console.log(`   Updated booking status: ${updatedBooking.status}`);
  addLog('success', `Booking ${ctx.bookingId} updated to ${newStatus}`, { bookingId: ctx.bookingId, action: ctx.action, newStatus });

  // 5. Обновляем сообщение у менеджера (убираем кнопки, пишем статус)
  // Используем обновленное бронирование
  await updateManagerMessage(ctx, newStatus, updatedBooking as BookingWithDetails);

  // 6. Уведомляем клиента
  const { sendClientStatusNotification } = await import('~/server/utils/telegram-notifications');
  await sendClientStatusNotification(updatedBooking as any, newStatus);
}

/**
 * Обрабатывает callback для групповых поездок
 */
async function handleGroupTripBooking(event: H3Event, ctx: BookingContext) {
  const supabase = serverSupabaseServiceRole<Database>(event);

  console.log(`🔍 Fetching group trip booking with ID: ${ctx.bookingId}`);
  
  // 1. Получаем бронирование групповой поездки со всеми деталями
  const { data: booking, error: fetchError } = await supabase
    .from('group_trip_bookings')
    .select('*, profile:profiles(*), group_trip:group_trips(*, boat:boats(*))')
    .eq('id', ctx.bookingId)
    .single();

  if (fetchError || !booking) {
    console.error(`🚨 Group trip booking not found or fetch error for ID ${ctx.bookingId}:`, fetchError);
    console.error(`   Error details:`, JSON.stringify(fetchError, null, 2));
    // Обновляем сообщение с ошибкой (callback_query уже отвечен в начале)
    await updateGroupTripManagerMessage(ctx, 'not_found');
    return;
  }

  console.log(`✅ Group trip booking found: ${booking.id}, current status: ${booking.status}`);

  // 2. Проверяем, не было ли бронирование уже обработано
  // Для групповых поездок статусы: confirmed, completed, cancelled
  // Но кнопки показываются только для confirmed, так что проверяем на cancelled
  if (booking.status === 'cancelled') {
    // Обновляем сообщение (callback_query уже отвечен в начале)
    await updateGroupTripManagerMessage(ctx, booking.status, booking);
    return;
  }

  // 3. Обновляем статус
  // Для групповых поездок: confirm -> confirmed (уже confirmed по умолчанию), cancel -> cancelled
  let newStatus: string;
  if (ctx.action === 'confirm') {
    // Если уже confirmed, ничего не делаем
    if (booking.status === 'confirmed') {
      // Обновляем сообщение (callback_query уже отвечен в начале)
      await updateGroupTripManagerMessage(ctx, booking.status, booking);
      return;
    }
    newStatus = 'confirmed';
  } else {
    newStatus = 'cancelled';
  }

  console.log(`🔄 Updating group trip booking ${ctx.bookingId} status from ${booking.status} to ${newStatus}`);
  
  const { data: updatedBooking, error: updateError } = await supabase
    .from('group_trip_bookings')
    .update({ status: newStatus })
    .eq('id', ctx.bookingId)
    .select('*, profile:profiles(*), group_trip:group_trips(*, boat:boats(*))')
    .single();

  if (updateError) {
    console.error(`🚨 DB update error for group trip booking ${ctx.bookingId}:`, updateError);
    console.error(`   Error details:`, JSON.stringify(updateError, null, 2));
    // Обновляем сообщение с ошибкой (callback_query уже отвечен в начале)
    await updateGroupTripManagerMessage(ctx, 'error', booking);
    return;
  }

  if (!updatedBooking) {
    console.error(`🚨 Group trip booking ${ctx.bookingId} not found after update`);
    await updateGroupTripManagerMessage(ctx, 'error', booking);
    return;
  }

  console.log(`✅ Successfully updated group trip booking ${ctx.bookingId} to ${newStatus}`);
  console.log(`   Updated booking status: ${updatedBooking.status}`);

  // 4. Обновляем сообщение у менеджера (убираем кнопки, пишем статус)
  // Используем обновленное бронирование
  await updateGroupTripManagerMessage(ctx, newStatus, updatedBooking);

  // 5. Уведомляем клиента
  const { sendGroupTripStatusNotification } = await import('~/server/utils/telegram-notifications');
  await sendGroupTripStatusNotification(updatedBooking as any, newStatus);
}

/**
 * Обновляет сообщение менеджера для групповых поездок
 */
async function updateGroupTripManagerMessage(ctx: BookingContext, status: string, booking?: any) {
  const statusMap: Record<string, { text: string; emoji: string }> = {
    confirmed: { text: 'ПОДТВЕРЖДЕНО', emoji: '✅' },
    cancelled: { text: 'ОТМЕНЕНО', emoji: '❌' },
    completed: { text: 'ЗАВЕРШЕНО', emoji: '🏁' },
    not_found: { text: 'НЕ НАЙДЕНО', emoji: '❓' },
    error: { text: 'ОШИБКА', emoji: '🚨' },
  };

  const { text: statusText, emoji } = statusMap[status] || { text: status.toUpperCase(), emoji: '⚠️' };

  let messageBody: string;
  if (booking) {
    const clientName = booking.profile?.name || booking.guest_name || 'Имя не указано';
    const clientTelegram = booking.profile?.telegram_id || booking.guest_phone || 'N/A';
    const totalTickets = (booking.adult_count || 0) + (booking.child_count || 0);

    const date = booking.group_trip?.start_time 
      ? new Date(booking.group_trip.start_time).toLocaleDateString('ru-RU')
      : 'Не указано';
    const time = booking.group_trip?.start_time && booking.group_trip?.end_time
      ? `${new Date(booking.group_trip.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${new Date(booking.group_trip.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      : 'Не указано';

    messageBody = [
      `🚤 <b>Лодка:</b> ${booking.group_trip?.boat?.name || 'Неизвестно'}`,
      `👤 <b>Клиент:</b> ${clientName.trim()}`,
      `📞 <b>Контакт:</b> ${clientTelegram}`,
      `📅 <b>Дата:</b> ${date}`,
      `⏰ <b>Время:</b> ${time}`,
      `👥 <b>Билеты:</b> ${booking.adult_count || 0} взр. + ${booking.child_count || 0} дет. = ${totalTickets} мест`,
      `💰 <b>Стоимость:</b> ${booking.total_price} ₽`,
    ].join('\n');
  } else {
    messageBody = `Бронирование групповой поездки с ID: ${ctx.bookingId} не найдено в системе.`;
  }

  const fullMessage = `${emoji} <b>ГРУППОВАЯ ПОЕЗДКА ${statusText}</b> ${emoji}\n\n${messageBody}`;

  console.log(`📝 Updating group trip message for manager ${ctx.managerChatId}, message ${ctx.messageId}`);
  console.log(`📄 New message text: ${fullMessage.substring(0, 100)}...`);

  try {
    await sendTelegramRequest('editMessageText', {
      chat_id: ctx.managerChatId,
      message_id: ctx.messageId,
      text: fullMessage,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [] }, // Убираем кнопки
    });
    console.log(`✅ Successfully updated group trip manager message`);
  } catch (error) {
    console.error(`❌ Failed to update group trip manager message:`, error);
  }
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
    error: { text: 'ОШИБКА', emoji: '🚨' },
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
