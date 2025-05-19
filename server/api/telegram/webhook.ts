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
  
  // Если получена команда /start
  if (text && text.startsWith('/start')) {
    // Отправляем приветственное сообщение с кнопкой для открытия приложения
    return await sendWebAppButton(
      chat.id, 
      'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть приложение для бронирования лодок.',
      'Открыть'
    )
  }

  return { status: 200, body: { success: true } }
})

// Функция для отправки сообщения с кнопкой WebApp
async function sendWebAppButton(chatId: number, text: string, buttonText: string) {
  // Получаем Bot API Token из переменных окружения
  const token = process.env.TELEGRAM_BOT_TOKEN
  
  // URL вашего Telegram Mini App
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL || 'https://your-app-url.com'
  
  // Формируем запрос к Telegram Bot API
  const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`
  
  // Формируем клавиатуру с WebApp кнопкой
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
  
  // Отправляем запрос к Telegram API
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
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