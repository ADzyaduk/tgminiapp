import { defineEventHandler, readBody, getQuery } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

// Обработчик Telegram webhook
export default defineEventHandler(async (event) => {
  // Проверка метода запроса
  if (event.method !== 'POST') {
    return { status: 405, body: { error: 'Method not allowed' } }
  }

  // Получение данных запроса
  const body = await readBody(event)

  // Проверка наличия сообщения
  if (!body || !body.message) {
    return { status: 400, body: { error: 'Invalid request' } }
  }

  // Получаем данные запроса
  const { message } = body
  const { chat, text, from } = message

  // Получаем клиент Supabase
  const supabase = await serverSupabaseClient(event)

  // Автоматическое приветствие для новых пользователей (без команды)
  if (text && !text.startsWith('/')) {
    // Проверяем, первый ли раз пользователь пишет боту
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('telegram_id', from.id.toString())
      .single()

    if (!existingUser) {
      // Новый пользователь - показываем приветствие
      return await handleStartCommand(chat.id, from, supabase)
    }
  }

  // Обработка команд
  if (text && text.startsWith('/')) {
    const command = text.split(' ')[0].toLowerCase()

    switch (command) {
      case '/start':
        return await handleStartCommand(chat.id, from, supabase)

      case '/help':
        return await handleHelpCommand(chat.id)

      default:
        return await sendMessage(chat.id, '👋 Привет! Используйте /start для открытия приложения.')
    }
  }

  return { status: 200, body: { success: true } }
})

// Обработка команды /start
async function handleStartCommand(chatId: number, from: any, supabase: any) {
  // Сохраняем/обновляем Telegram ID пользователя
  const userResult = await saveTelegramUser(from, supabase)

  let message = ''

  if (userResult && userResult.id) {
    if (userResult.role === 'telegram_only') {
      // Telegram-only пользователь (для уведомлений)
      message = `👋 Добро пожаловать в систему бронирования лодок!

🚀 Нажмите кнопку ниже, чтобы открыть приложение и забронировать лодку.

📱 Вы можете:
• Бронировать лодки БЕЗ регистрации
• Получать уведомления прямо в Telegram
• При желании зарегистрироваться для полного доступа

🔔 Ваш Telegram ID: <code>${from.id}</code> (готов для уведомлений)

💡 Бронирования будут привязаны к этому Telegram аккаунту`
    } else {
      // Полноценный зарегистрированный пользователь
      message = `👋 Добро пожаловать в систему бронирования лодок!

🚀 Нажмите кнопку ниже, чтобы открыть приложение и забронировать лодку.

📱 В приложении вы можете:
• Выбрать лодку и время
• Оформить бронирование
• Управлять своими бронированиями
• Отслеживать статус заявок

🔔 Я буду присылать вам уведомления о статусе бронирования прямо в Telegram!

🆔 Ваш Telegram ID: <code>${from.id}</code> (связан с аккаунтом ${userResult.email})`
    }
  } else {
    // Ошибка создания
    message = `👋 Добро пожаловать в систему бронирования лодок!

❌ Произошла ошибка при настройке уведомлений.

🚀 Вы все равно можете пользоваться приложением:`
  }

  return await sendWebAppButton(chatId, message, '🚀 Открыть приложение')
}

// Обработка команды /help
async function handleHelpCommand(chatId: number) {
  const message = `🤖 <b>Бот для бронирования лодок</b>

🚀 <b>Главная функция:</b>
Открыть приложение командой /start

🔔 <b>Уведомления:</b>
Я автоматически присылаю уведомления о:
• Подтверждении бронирования ✅
• Отмене бронирования ❌
• Напоминаниях перед поездкой 📅

📱 Все бронирования делаются в приложении!`

  return await sendMessage(chatId, message)
}

// Обработка команды /mybookings
async function handleMyBookingsCommand(chatId: number, from: any, supabase: any) {
  // Ищем пользователя в базе
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', from.id.toString())
    .single()

  if (!user) {
    const message = `❌ Вы не зарегистрированы в системе.

Пожалуйста, сначала зайдите в приложение через кнопку "Открыть приложение" в команде /start и создайте профиль.`

    return await sendMessage(chatId, message)
  }

  // Получаем бронирования пользователя
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, boat:boat_id(name)')
    .eq('user_id', user.id)
    .order('start_time', { ascending: false })
    .limit(5)

  if (!bookings || bookings.length === 0) {
    return await sendMessage(chatId, '📋 У вас пока нет бронирований.\n\nИспользуйте /start чтобы открыть приложение и забронировать лодку.')
  }

  let message = '📋 <b>Ваши последние бронирования:</b>\n\n'

  bookings.forEach((booking: any, index: number) => {
    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      confirmed: '✅',
      cancelled: '❌'
    }

    const emoji = statusEmoji[booking.status] || '🔔'

    const date = new Date(booking.start_time).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })

    message += `${index + 1}. ${emoji} <b>${booking.boat?.name || 'Лодка'}</b>
📅 ${date}
💰 ${booking.price} ₽
📊 Статус: ${booking.status === 'pending' ? 'Ожидает подтверждения' : booking.status === 'confirmed' ? 'Подтверждено' : 'Отменено'}

`
  })

  message += '\nИспользуйте /start для создания новых бронирований.'

  return await sendMessage(chatId, message)
}

// Обработка команды /status
async function handleStatusCommand(chatId: number, from: any, supabase: any) {
  // Ищем пользователя в базе
  const { data: user } = await supabase
    .from('profiles')
    .select('id')
    .eq('telegram_id', from.id.toString())
    .single()

  if (!user) {
    return await sendMessage(chatId, '❌ Вы не зарегистрированы в системе.')
  }

  // Получаем последнее бронирование
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, boat:boat_id(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!booking) {
    return await sendMessage(chatId, '📋 У вас нет бронирований.')
  }

  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    confirmed: '✅',
    cancelled: '❌'
  }

  const emoji = statusEmoji[booking.status] || '🔔'

  const date = new Date(booking.start_time).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit'
  })

  const message = `${emoji} <b>Последнее бронирование</b>

🛥️ Лодка: ${booking.boat?.name || 'Не указано'}
📅 Дата: ${date}
💰 Цена: ${booking.price} ₽
📊 Статус: ${booking.status === 'pending' ? 'Ожидает подтверждения' : booking.status === 'confirmed' ? 'Подтверждено' : 'Отменено'}

${booking.status === 'pending' ? '⏳ Ожидайте подтверждения от администратора.' : ''}
${booking.status === 'confirmed' ? '✅ Ваше бронирование подтверждено! Увидимся в назначенное время.' : ''}
${booking.status === 'cancelled' ? '❌ К сожалению, бронирование было отменено.' : ''}`

  return await sendMessage(chatId, message)
}

// Обработка команды /boats
async function handleBoatsCommand(chatId: number, supabase: any) {
  const { data: boats } = await supabase
    .from('boats')
    .select('*')
    .eq('active', true)
    .order('name')

  if (!boats || boats.length === 0) {
    return await sendMessage(chatId, '🛥️ В данный момент лодки недоступны.')
  }

  let message = '🛥️ <b>Доступные лодки:</b>\n\n'

  boats.forEach((boat: any, index: number) => {
    message += `${index + 1}. <b>${boat.name}</b>
💰 От ${boat.price} ₽/час
👥 Вместимость: ${boat.capacity} человек
${boat.description ? `📝 ${boat.description}` : ''}

`
  })

  message += '\nИспользуйте /start чтобы открыть приложение и забронировать лодку.'

  return await sendMessage(chatId, message)
}

// Функция для отправки сообщения с кнопкой WebApp
async function sendWebAppButton(chatId: number, text: string, buttonText: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://your-app-url.com'

  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: buttonText,
          web_app: { url: webAppUrl }
        }
      ]
    ]
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    })

    const data = await response.json()
    return { status: 200, body: data }
  } catch (error) {
    console.error('Error sending message to Telegram:', error)
    return { status: 500, body: { error: 'Failed to send message' } }
  }
}

// Функция для отправки обычного сообщения
async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    })

    const data = await response.json()
    return { status: 200, body: data }
  } catch (error) {
    console.error('Error sending message to Telegram:', error)
    return { status: 500, body: { error: 'Failed to send message' } }
  }
}

// Функция для сохранения Telegram пользователя
async function saveTelegramUser(from: any, supabase: any) {
  try {
    // Проверяем есть ли уже пользователь с таким telegram_id
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .eq('telegram_id', from.id.toString())
      .single()

    if (existingUser) {
      console.log(`Existing user found: ${existingUser.name || existingUser.email}`)
      return existingUser
    }

    // Создаем нового пользователя ТОЛЬКО для Telegram уведомлений
    // Помечаем его как telegram_only чтобы отличать от полноценных аккаунтов
    const { data: newUser, error } = await supabase
      .from('profiles')
      .insert({
        telegram_id: from.id.toString(),
        name: `${from.first_name || ''} ${from.last_name || ''}`.trim() || from.username || 'Telegram User',
        email: from.username ? `${from.username}@telegram.local` : `telegram_${from.id}@local`,
        role: 'telegram_only' // Специальная роль для Telegram-only пользователей
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating telegram user:', error)
      return null
    } else {
      console.log(`Created new telegram-only user with ID ${from.id}`)
      return newUser
    }
  } catch (error) {
    console.error('Error in saveTelegramUser:', error)
    return null
  }
}
