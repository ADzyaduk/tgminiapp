import { defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "1231157381"

    if (!token) {
      return {
        error: 'Bot token not found',
        env_check: {
          TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
          TELEGRAM_ADMIN_CHAT_ID: !!process.env.TELEGRAM_ADMIN_CHAT_ID
        }
      }
    }

    const testMessage = `🧪 <b>Тестовое уведомление</b>

📅 Время: ${new Date().toLocaleString('ru-RU')}
🎯 Это проверка системы уведомлений

✅ Если вы видите это сообщение - уведомления работают!`

    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    console.log(`Sending test notification to chat ID: ${adminChatId}`)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: adminChatId,
        text: testMessage,
        parse_mode: 'HTML'
      })
    })

    const result = await response.json()

    console.log('Telegram API response:', result)

    return {
      success: response.ok,
      telegram_response: result,
      sent_to_chat: adminChatId,
      bot_token_exists: !!token,
      response_status: response.status
    }
  } catch (error: any) {
    console.error('Test notification error:', error)
    return {
      error: 'Failed to send test notification',
      details: error?.message || 'Unknown error'
    }
  }
})
