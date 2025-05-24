// ~/composables/useAuth.ts
import { ref, computed, readonly } from 'vue'
import type { User, Session } from '@supabase/supabase-js'
import { useRouter } from 'vue-router'
import { useSupabaseClient } from '#imports'

// Глобальное состояние - разделяется между всеми компонентами
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const profile = ref<any>(null)
const initializing = ref(true)

export const useAuth = () => {
  const supabase = useSupabaseClient()
  const router = useRouter()

  // Вычисляемые свойства
  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => {
    return profile.value?.role === 'admin' || 
           user.value?.user_metadata?.role === 'admin'
  })
  const userEmail = computed(() => user.value?.email || '')
  const userId = computed(() => user.value?.id || '')

  // Инициализация аутентификации
  const initializeAuth = async () => {
    if (import.meta.dev) {
      console.log('🔐 Initializing auth...')
    }

    try {
      initializing.value = true
      
      // Получаем текущую сессию
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('❌ Error getting session:', error)
        return
      }

      if (currentSession) {
        session.value = currentSession
        user.value = currentSession.user
        
        // Загружаем профиль пользователя
        await loadProfile()
        
        if (import.meta.dev) {
          console.log('✅ Session restored:', user.value?.email)
        }
      } else {
        if (import.meta.dev) {
          console.log('ℹ️ No active session found')
        }
      }

      // Слушаем изменения состояния авторизации
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (import.meta.dev) {
          console.log('🔄 Auth state changed:', event)
        }

        session.value = newSession
        user.value = newSession?.user || null

        if (event === 'SIGNED_IN' && user.value) {
          await loadProfile()
        } else if (event === 'SIGNED_OUT') {
          profile.value = null
        }
      })

    } catch (error) {
      console.error('❌ Auth initialization error:', error)
    } finally {
      initializing.value = false
    }
  }

  // Загрузка профиля пользователя
  const loadProfile = async () => {
    if (!user.value) return

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
        return
      }

      profile.value = data || {}
    } catch (error) {
      console.error('Profile loading error:', error)
    }
  }

  // Авторизация с email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Sign in error:', error)
        return { success: false, data: null, error: error.message }
      }

      if (import.meta.dev) {
        console.log('✅ Signed in successfully')
      }

      return { success: true, data, error: null }
    } catch (error: any) {
      console.error('❌ Sign in error:', error)
      return { success: false, data: null, error: error.message || 'Неизвестная ошибка' }
    }
  }

  // Регистрация
  const signUp = async (email: string, password: string, userData: any = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      })

      if (error) {
        console.error('❌ Sign up error:', error)
        return { success: false, data: null, error: error.message }
      }

      if (import.meta.dev) {
        console.log('✅ Signed up successfully')
      }

      return { success: true, data, error: null }
    } catch (error: any) {
      console.error('❌ Sign up error:', error)
      return { success: false, data: null, error: error.message || 'Неизвестная ошибка' }
    }
  }

  // Выход
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error

      // Очищаем состояние
      user.value = null
      session.value = null
      profile.value = null

      // Редиректим на login
      await router.push('/login')

      if (import.meta.dev) {
        console.log('✅ Signed out successfully')
      }

      return { error: null }
    } catch (error) {
      console.error('❌ Sign out error:', error)
      return { error }
    }
  }

  return {
    // Состояние
    user: readonly(user),
    session: readonly(session),
    profile: readonly(profile),
    initializing: readonly(initializing),
    
    // Вычисляемые свойства
    isLoggedIn,
    isAdmin,
    userEmail,
    userId,
    
    // Методы
    initializeAuth,
    loadProfile,
    signIn,
    signUp,
    signOut
  }
}
