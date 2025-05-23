// ~/composables/useAuth.ts
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSupabaseClient } from '#imports'

// Global state - все компоненты будут использовать одно и то же состояние
const user = ref<null | { id: string; email: string; role: string }>(null)
const isAdmin = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)

let authListener: any = null
let isInitialized = false

export function useAuth() {
  const router = useRouter()
  const supabaseClient = useSupabaseClient()

  async function fetchUser() {
    loading.value = true
    error.value = null
    try {
      const { data: { user: u }, error: err } = await supabaseClient.auth.getUser()
      if (err) throw err
      if (!u) {
        user.value = null
        isAdmin.value = false
        return
      } else {
        const { data: profile, error: pErr } = await supabaseClient
          .from('profiles')
          .select('id, email, role')
          .eq('id', u.id)
          .single()
        if (pErr) throw pErr
        user.value = profile
        isAdmin.value = profile.role === 'admin'
      }
    } catch (e: any) {
      error.value = e.message
      user.value = null
      isAdmin.value = false
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    loading.value = true
    try {
      await supabaseClient.auth.signOut()
      user.value = null
      isAdmin.value = false
      router.replace('/login')
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // Инициализируем auth listener только один раз
  if (!isInitialized) {
    authListener = supabaseClient.auth.onAuthStateChange((event) => {
      console.log('Auth state change:', event)
      if (event === 'SIGNED_OUT') {
        user.value = null
        isAdmin.value = false
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser()
      }
    })
    
    isInitialized = true
    
    // Вызываем fetchUser при первой инициализации
    if (process.client) {
      fetchUser()
    }
  }

  onMounted(() => {
    if (!user.value && !loading.value) {
      fetchUser()
    }
  })
  
  // Clean up listener when component unmounts
  onUnmounted(() => {
    // НЕ очищаем listener при размонтировании компонента, 
    // так как это глобальное состояние
  })

  return { user, isAdmin, loading, error, fetchUser, signOut }
}
