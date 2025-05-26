// ~/composables/useManager.ts
import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useSupabaseClient } from '#imports'

export function useManager(userId: Ref<string | null>, boatId: Ref<string | null>) {
  const isManager = ref(false)
  const supabaseClient = useSupabaseClient()

  const checkManager = async () => {
    if (!userId.value || !boatId.value) {
      isManager.value = false
      return
    }
    try {
      const { data, error } = await supabaseClient
        .from('boat_managers')
        .select('user_id')
        .eq('boat_id', boatId.value)
        .eq('user_id', userId.value)
        .maybeSingle()
      
      if (error) throw error
      
      isManager.value = !!data
    } catch (error) {
      console.error('useManager: Exception', error)
      isManager.value = false
    }
  }

  watch([userId, boatId], checkManager, { immediate: true })

  return { isManager, checkManager }
}
