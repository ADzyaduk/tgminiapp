// ~/composables/useBoat.ts
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSupabaseClient } from '#imports'

export function useBoat() {
  const route = useRoute()
  const slug = computed(() => route.params.slug as string)
  const boat = ref<null | any>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const supabaseClient = useSupabaseClient()

  const fetchBoat = async () => {
    if (!slug.value) return
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabaseClient
        .from('boats')
        .select('*')
        .eq('slug', slug.value)
        .single()
      if (err) throw err
      boat.value = data
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  watch(slug, fetchBoat, { immediate: true })

  return { boat, loading, error, fetchBoat }
}
