import { defineEventHandler, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { chat_id, message } = body

    const token = process.env.TELEGRAM_BOT_TOKEN

    if (!token) {
      return {
        status: 500,
        body: { error: 'Bot token not found' }
      }
    }

    const testMessage = message || `🧪 <b>Тестовое уведомление</b>

📅 Время: ${new Date().toLocaleString('ru-RU')}
🎯 Это проверка системы уведомлений

✅ Если вы видите это сообщение - уведомления работают!`

    const testChatId = chat_id || "1231157381" // Ваш админский ID

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    console.log(`Sending test notification to chat ID: ${testChatId}`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: testChatId,
        text: testMessage,
        parse_mode: 'HTML'
      })
    })

    const result = await response.json()

    console.log('Telegram API response:', result)

    return {
      status: 200,
      body: {
        success: response.ok,
        telegram_response: result,
        sent_to_chat: testChatId,
        bot_token_exists: !!token
      }
    }
  } catch (error: any) {
    console.error('Test notification error:', error)
    return {
      status: 500,
      body: {
        error: 'Failed to send test notification',
        details: error?.message || 'Unknown error'
      }
    }
  }
})
