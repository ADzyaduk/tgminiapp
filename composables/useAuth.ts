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

  async function fetchUserProfile(userId: string) {
    loading.value = true
    error.value = null
    try {
      const { data: profile, error: pErr } = await supabaseClient
        .from('profiles')
        .select('id, email, role')
        .eq('id', userId)
        .single()
        
      if (pErr) {
        console.error('Profile query error:', pErr)
        throw pErr
      }
      
      if (!profile) {
        user.value = null
        isAdmin.value = false
        return
      }
      
      user.value = profile
      isAdmin.value = profile.role === 'admin'
    } catch (e: any) {
      console.error('Error fetching user profile:', e)
      error.value = e.message
      user.value = null
      isAdmin.value = false
    } finally {
      loading.value = false
    }
  }

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
        await fetchUserProfile(u.id)
      }
    } catch (e: any) {
      console.error('Error fetching user:', e)
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
    authListener = supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', event, session?.user?.email)
      if (event === 'SIGNED_OUT') {
        user.value = null
        isAdmin.value = false
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Используем user из session напрямую, без дополнительного getUser() вызова
        console.log('✅ Using session from auth event:', session.user.email)
        fetchUserProfile(session.user.id)
      } else if (event === 'TOKEN_REFRESHED') {
        // Для TOKEN_REFRESHED используем обычный fetchUser
        setTimeout(() => {
          fetchUser()
        }, 100)
      }
    })
    
    isInitialized = true
    
    // Проверяем начальную сессию при инициализации клиента
    if (process.client) {
      // Получаем сессию напрямую вместо getUser()
      console.log('🔍 Checking for existing session on app init...')
      supabaseClient.auth.getSession().then(({ data: { session }, error }) => {
        console.log('🔍 getSession result:', { session: session?.user?.email, error })
        if (error) {
          console.error('❌ Error getting initial session:', error)
          loading.value = false
          return
        }
        
        if (session?.user) {
          console.log('✅ Found existing session, user:', session.user.email)
          fetchUserProfile(session.user.id)
        } else {
          console.log('❌ No existing session found')
          // Попробуем проверить localStorage напрямую
          const stored = localStorage.getItem('supabase.auth.token')
          console.log('💾 localStorage token:', stored ? 'exists' : 'missing')
          loading.value = false
        }
      })
    }
  }

  onMounted(() => {
    // Не вызываем fetchUser() в onMounted - auth listener должен обработать начальное состояние
    // if (!user.value && !loading.value) {
    //   fetchUser()
    // }
  })
  
  // Clean up listener when component unmounts
  onUnmounted(() => {
    // НЕ очищаем listener при размонтировании компонента, 
    // так как это глобальное состояние
  })

  return { user, isAdmin, loading, error, fetchUser, fetchUserProfile, signOut }
}
