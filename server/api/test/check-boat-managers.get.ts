import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const supabase = serverSupabaseServiceRole(event)

    // Получаем все лодки
    const { data: boats, error: boatsError } = await supabase
      .from('boats')
      .select('id, name')

    if (boatsError) {
      return { error: 'Failed to get boats', details: boatsError }
    }

    // Проверяем менеджеров для каждой лодки
    const boatManagersInfo = await Promise.all(
      (boats || []).map(async (boat: any) => {
        // Получаем менеджеров лодки
        const { data: managers } = await supabase
          .from('boat_managers')
          .select('user_id')
          .eq('boat_id', boat.id)

        let managersWithTelegram: any[] = []
        if (managers && managers.length > 0) {
          // Получаем профили менеджеров с telegram_id
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, telegram_id, role')
            .in('id', managers.map((m: any) => m.user_id))

          managersWithTelegram = (profiles || []).filter((p: any) => p.telegram_id)
        }

        return {
          boat_id: boat.id,
          boat_name: boat.name,
          total_managers: managers?.length || 0,
          managers_with_telegram: managersWithTelegram.length,
          managers: managersWithTelegram
        }
      })
    )

    // Проверяем общую статистику
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, name, telegram_id, role')
      .not('telegram_id', 'is', null)

    return {
      success: true,
      summary: {
        total_boats: boats?.length || 0,
        boats_with_managers: boatManagersInfo.filter(b => b.total_managers > 0).length,
        boats_with_telegram_managers: boatManagersInfo.filter(b => b.managers_with_telegram > 0).length,
        total_users_with_telegram: allProfiles?.length || 0
      },
      boats: boatManagersInfo,
      users_with_telegram: allProfiles || []
    }

  } catch (error) {
    return {
      success: false,
      error: (error as any)?.message || 'Unknown error'
    }
  }
})
