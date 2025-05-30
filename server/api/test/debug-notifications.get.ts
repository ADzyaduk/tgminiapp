import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = await serverSupabaseClient(event)

    // 1. Проверяем переменные окружения
    const telegramConfig = {
      bot_token: process.env.TELEGRAM_BOT_TOKEN ? '✅ Установлен' : '❌ Отсутствует',
      admin_chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID || 'Не установлен (будет использован hardcode)',
      webapp_url: process.env.TELEGRAM_WEBAPP_URL || 'Не установлен'
    }

    // 2. Проверяем пользователей с Telegram ID
    const { data: usersWithTelegram, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, email, telegram_id, role')
      .not('telegram_id', 'is', null)

    // 3. Проверяем менеджеров лодок
    const { data: boatManagers, error: managersError } = await supabase
      .from('boat_managers')
      .select(`
        id,
        boat_id,
        user_id,
        boat:boat_id(name),
        profile:user_id(name, email, telegram_id)
      `)

    // 4. Проверяем последние бронирования
    const { data: recentBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, boat_id, guest_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // 5. Проверяем лодки
    const { data: boats, error: boatsError } = await supabase
      .from('boats')
      .select('id, name, status')
      .limit(10)

    const telegramManagersCount = boatManagers?.filter((m: any) => m.profile?.telegram_id)?.length || 0

    return {
      status: 200,
      data: {
        telegram_config: telegramConfig,
        users_with_telegram: usersWithTelegram || [],
        boat_managers: boatManagers || [],
        recent_bookings: recentBookings || [],
        boats: boats || [],
        errors: {
          users: usersError?.message,
          managers: managersError?.message,
          bookings: bookingsError?.message,
          boats: boatsError?.message
        },
        summary: {
          total_telegram_users: usersWithTelegram?.length || 0,
          total_boat_managers: boatManagers?.length || 0,
          total_recent_bookings: recentBookings?.length || 0,
          telegram_managers_count: telegramManagersCount
        }
      }
    }
  } catch (error: any) {
    console.error('Debug endpoint error:', error)
    return {
      status: 500,
      error: 'Failed to fetch debug data',
      details: error?.message || 'Unknown error'
    }
  }
})
