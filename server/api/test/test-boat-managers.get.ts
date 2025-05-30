import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

interface Manager {
  user_id: string
}

interface Profile {
  telegram_id: string
  name: string
  email: string
}

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)
    const boatId = "874f57d8-82fa-4b88-96b8-cc5e8e1066d7" // Kiss

    // Получаем менеджеров лодки Kiss
    const { data: managers } = await supabase
      .from('boat_managers')
      .select('user_id')
      .eq('boat_id', boatId) as { data: Manager[] | null }

    console.log('Found managers:', managers)

    if (!managers || managers.length === 0) {
      return { error: 'No managers found for boat Kiss' }
    }

    // Получаем Telegram ID менеджеров
    const { data: profiles } = await supabase
      .from('profiles')
      .select('telegram_id, name, email')
      .in('id', managers.map((m: Manager) => m.user_id))
      .not('telegram_id', 'is', null) as { data: Profile[] | null }

    console.log('Profiles with telegram_id:', profiles)

    if (!profiles || profiles.length === 0) {
      return { error: 'No managers with telegram_id found' }
    }

    // Отправляем тестовое сообщение каждому менеджеру
    const token = process.env.TELEGRAM_BOT_TOKEN
    const apiUrl = `https://api.telegram.org/bot${token}/sendMessage`

    const results = []

    for (const profile of profiles) {
      const testMessage = `🧪 <b>Тест уведомления менеджера</b>

👤 Менеджер: ${profile.name} (${profile.email})
🛥️ Лодка: Kiss
📅 Время: ${new Date().toLocaleString('ru-RU')}

✅ Если видите это - уведомления менеджерам работают!`

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: profile.telegram_id,
            text: testMessage,
            parse_mode: 'HTML'
          })
        })

        const result = await response.json()
        results.push({
          manager: profile.name,
          telegram_id: profile.telegram_id,
          success: response.ok,
          result
        })
      } catch (error) {
        results.push({
          manager: profile.name,
          telegram_id: profile.telegram_id,
          success: false,
          error: (error as Error).message
        })
      }
    }

    return {
      boat_id: boatId,
      managers_found: managers.length,
      profiles_with_telegram: profiles.length,
      results
    }
  } catch (error: any) {
    return {
      error: 'Test failed',
      details: error?.message || 'Unknown error'
    }
  }
})
