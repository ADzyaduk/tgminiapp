// ~/composables/useAuth.ts
import { ref, computed } from 'vue'
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
    // Проверяем роль из профиля или из метаданных пользователя
    return profile.value?.role === 'admin' || 
           user.value?.user_metadata?.role === 'admin'
  })
  const userEmail = computed(() => user.value?.email)
  const userId = computed(() => user.value?.id)

  // Инициализация - выполняется один раз
  const initializeAuth = async () => {
    try {
      initializing.value = true

      // Проверяем localStorage напрямую для более надежного восстановления
      if (typeof window !== 'undefined') {
        // Проверяем наличие токенов в localStorage
        const tokens = ['sb-access-token', 'sb-refresh-token', 'sb-auth-token']
        const hasTokens = tokens.some(key => localStorage.getItem(key))
        
        if (import.meta.dev) {
          console.log('LocalStorage tokens check:', {
            hasTokens,
            keys: tokens.map(key => ({ [key]: !!localStorage.getItem(key) }))
          })
        }
      }

      // Пробуем восстановить сессию несколько раз
      let currentSession = null
      let attempts = 0
      const maxAttempts = 5

      while (!currentSession && attempts < maxAttempts) {
        try {
          const { data: { session: sessionData }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            if (import.meta.dev) {
              console.warn(`Session attempt ${attempts + 1} failed:`, sessionError)
            }
            attempts++
            if (attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 200 * attempts)) // Экспоненциальная задержка
              continue
            }
            break
          }

          currentSession = sessionData
          break
        } catch (error) {
          if (import.meta.dev) {
            console.warn(`Session attempt ${attempts + 1} error:`, error)
          }
          attempts++
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 200 * attempts))
          }
        }
      }

      // Устанавливаем начальное состояние
      session.value = currentSession
      user.value = currentSession?.user ?? null

      if (import.meta.dev) {
        console.log('Auth initialized:', {
          hasSession: !!currentSession,
          hasUser: !!user.value,
          userEmail: user.value?.email,
          attempts
        })
      }

      // Если есть пользователь, загружаем профиль
      if (user.value) {
        await fetchProfile()
      }

      // Настраиваем слушатель изменений авторизации
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (import.meta.dev) {
          console.log('Auth state change:', event, newSession?.user?.email)
        }
        
        session.value = newSession
        user.value = newSession?.user ?? null

        // Дополнительно сохраняем в localStorage для надежности
        if (typeof window !== 'undefined') {
          if (newSession) {
            localStorage.setItem('sb-auth-session', JSON.stringify({
              user: newSession.user,
              access_token: newSession.access_token,
              refresh_token: newSession.refresh_token,
              expires_at: newSession.expires_at
            }))
          } else {
            localStorage.removeItem('sb-auth-session')
          }
        }

        switch (event) {
          case 'SIGNED_IN':
            await fetchProfile()
            break
          case 'SIGNED_OUT':
            profile.value = null
            // Очищаем localStorage при выходе
            if (typeof window !== 'undefined') {
              ['sb-access-token', 'sb-refresh-token', 'sb-auth-token', 'sb-auth-session'].forEach(key => {
                localStorage.removeItem(key)
              })
            }
            break
          case 'TOKEN_REFRESHED':
            if (user.value) {
              await fetchProfile()
            }
            break
          case 'USER_UPDATED':
            if (user.value) {
              await fetchProfile()
            }
            break
        }
      })

    } catch (error) {
      console.error('Auth initialization error:', error)
    } finally {
      initializing.value = false
    }
  }

  // Загрузка профиля пользователя
  const fetchProfile = async () => {
    if (!user.value) {
      profile.value = null
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      if (error) {
        console.warn('Profile fetch error:', error.message)
        
        // Если профиль не найден или есть проблемы с RLS,
        // создаем временный профиль из данных пользователя
        profile.value = {
          id: user.value.id,
          email: user.value.email,
          name: user.value.user_metadata?.full_name || user.value.user_metadata?.name || '',
          phone: user.value.user_metadata?.phone || '',
          role: user.value.user_metadata?.role || 'user'
        }
        return
      }

      profile.value = data
    } catch (error) {
      console.warn('Unexpected profile error:', error)
      
      // Fallback профиль
      profile.value = {
        id: user.value.id,
        email: user.value.email,
        name: user.value.user_metadata?.full_name || user.value.user_metadata?.name || '',
        phone: user.value.user_metadata?.phone || '',
        role: user.value.user_metadata?.role || 'user'
      }
    }
  }

  // Вход в систему с email/password
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error('Sign in error:', error)
      return { success: false, error: error.message }
    }
  }

  // Регистрация
  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (error) {
        throw error
      }

      return { success: true, data }
    } catch (error: any) {
      console.error('Sign up error:', error)
      return { success: false, error: error.message }
    }
  }

  // Выход из системы
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }

      // Очищаем состояние
      user.value = null
      session.value = null
      profile.value = null

      // Принудительно очищаем localStorage
      if (typeof window !== 'undefined') {
        ['sb-access-token', 'sb-refresh-token', 'sb-auth-token', 'sb-auth-session'].forEach(key => {
          localStorage.removeItem(key)
        })
      }

      // Перенаправляем на страницу входа
      await router.push('/login')

      return { success: true }
    } catch (error: any) {
      console.error('Sign out error:', error)
      return { success: false, error: error.message }
    }
  }

  // Вход через OAuth
  const signInWithOAuth = async (provider: any, options?: any) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          ...options
        }
      })

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error('OAuth sign in error:', error)
      return { success: false, error: error.message }
    }
  }

  // Обновление профиля
  const updateProfile = async (updates: any) => {
    if (!user.value) {
      return { success: false, error: 'Пользователь не авторизован' }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.value.id)

      if (error) {
        throw error
      }

      // Обновляем локальное состояние
      profile.value = { ...profile.value, ...updates }

      return { success: true }
    } catch (error: any) {
      console.error('Profile update error:', error)
      return { success: false, error: error.message }
    }
  }

  // Сброс пароля
  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      })

      if (error) {
        throw error
      }

      return { success: true }
    } catch (error: any) {
      console.error('Password reset error:', error)
      return { success: false, error: error.message }
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
    fetchProfile,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    updateProfile,
    resetPassword
  }
}
