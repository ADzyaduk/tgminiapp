import { ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'

// Типы для Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe: any
      }
    }
  }
}

// Типы для Telegram авторизации
interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  phone?: string
}

interface TelegramInitData {
  user?: TelegramUser
  chat_instance?: string
  chat_type?: string
  auth_date?: number
  hash?: string
}

interface TelegramAuthResponse {
  success: boolean
  user?: any
  error?: string
}

interface TelegramAuthApiResponse {
  success: boolean
  profile?: any
  telegramUser?: TelegramUser
  user?: any
  error?: string
}

interface PhoneUpdateResponse {
  success: boolean
  error?: string
}

// Глобальное состояние
const telegramUser = ref<TelegramUser | null>(null)
const isAuthenticated = ref(false)
const isLoading = ref(false)
const profile = ref<any>(null)

export const useTelegramAuth = () => {
  const router = useRouter()

  // Вычисляемые свойства
  const userId = computed(() => telegramUser.value?.id?.toString() || '')
  const userName = computed(() => {
    if (!telegramUser.value) return ''
    const { first_name, last_name, username } = telegramUser.value
    return `${first_name || ''} ${last_name || ''}`.trim() || username || ''
  })

  // Получение initData из Telegram WebApp
  const getTelegramInitData = (): string => {
    if (typeof window === 'undefined') return ''

    // В production используем Telegram WebApp API
    if (window.Telegram?.WebApp?.initData) {
      console.log('✅ Using Telegram WebApp initData')
      return window.Telegram.WebApp.initData
    }

    // Проверяем есть ли объект Telegram но нет initData
    if (window.Telegram?.WebApp && !window.Telegram.WebApp.initData) {
      console.warn('⚠️ Telegram WebApp found but initData is empty')
      console.warn('   This usually means the page was opened outside of Telegram')
      console.warn('   Please open this page through your Telegram bot')
    }

    // Проверяем есть ли объект Telegram вообще
    if (!window.Telegram) {
      console.error('❌ Telegram object not found')
      console.error('   Make sure telegram-web-app.js script is loaded')
      console.error('   Check if the script is added to nuxt.config.ts')
    }

    // В development режиме возвращаем фейковые данные
    const config = useRuntimeConfig()
    if (config.public.isTelegramDevMode) {
      console.log('🔧 Using development mode fake data')
      return 'query_id=dev&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Dev%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22devuser%22%7D&auth_date=1234567890&hash=fake_hash_for_dev'
    }

    return ''
  }

  // Парсинг initData
  const parseInitData = (initData: string): TelegramInitData => {
    if (!initData) return {}

    try {
      const params = new URLSearchParams(initData)
      const userParam = params.get('user')

      if (!userParam) return {}

      const user = JSON.parse(decodeURIComponent(userParam))

      return {
        user,
        chat_instance: params.get('chat_instance') || undefined,
        chat_type: params.get('chat_type') || undefined,
        auth_date: parseInt(params.get('auth_date') || '0'),
        hash: params.get('hash') || undefined
      }
    } catch (error) {
      console.error('Error parsing initData:', error)
      return {}
    }
  }

  // Авторизация через Telegram
  const signInWithTelegram = async (): Promise<TelegramAuthResponse> => {
    try {
      isLoading.value = true

      const initData = getTelegramInitData()
      if (!initData) {
        throw new Error('Telegram initData not found')
      }

      console.log('🔐 Authenticating with Telegram initData...')

      // Отправляем initData на сервер для валидации
      const response = await $fetch<TelegramAuthApiResponse>('/api/telegram/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { initData }
      })

      if (!response.success) {
        throw new Error(response.error || 'Authentication failed')
      }

      // Устанавливаем пользователя
      const parsedData = parseInitData(initData)
      telegramUser.value = parsedData.user || null
      isAuthenticated.value = true
      profile.value = response.profile

      console.log('✅ Telegram authentication successful')

      return {
        success: true,
        user: response.profile
      }

    } catch (error: any) {
      console.error('❌ Telegram authentication error:', error)

      telegramUser.value = null
      isAuthenticated.value = false
      profile.value = null

      return {
        success: false,
        error: error.message || 'Authentication failed'
      }
    } finally {
      isLoading.value = false
    }
  }

  // Выход из системы
  const signOut = async () => {
    try {
      // Очищаем JWT cookies на сервере
      await $fetch('/api/telegram/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // Очищаем локальное состояние
      telegramUser.value = null
      isAuthenticated.value = false
      profile.value = null

      console.log('✅ Signed out successfully')

      // Редиректим в корень
      await router.push('/')

    } catch (error) {
      console.error('❌ Sign out error:', error)
    }
  }

  // Проверка авторизации при загрузке
  const checkAuth = async () => {
    try {
      isLoading.value = true

      // Проверяем есть ли валидные JWT токены в cookies
      const response = await $fetch<TelegramAuthApiResponse>('/api/telegram/check-auth', {
        method: 'GET'
      })

      if (response.success && response.user) {
        telegramUser.value = response.telegramUser || null
        isAuthenticated.value = true
        profile.value = response.user

        console.log('✅ Auth restored from cookies')
        return true
      }

      return false

    } catch (error) {
      console.error('❌ Auth check error:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // Инициализация авторизации
  const initAuth = async () => {
    // Сначала проверяем существующие токены
    const hasValidAuth = await checkAuth()

    if (!hasValidAuth) {
      // Если нет валидных токенов, пробуем авторизоваться через Telegram
      await signInWithTelegram()
    }
  }

  // Обновление номера телефона (единственное что нужно будет вводить)
  const updatePhone = async (phone: string) => {
    try {
      const response = await $fetch<PhoneUpdateResponse>('/api/telegram/update-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { phone }
      })

      if (response.success) {
        // Обновляем локальный профиль
        if (profile.value) {
          profile.value.phone = phone
        }
        return { success: true }
      }

      return { success: false, error: response.error }

    } catch (error: any) {
      console.error('Error updating phone:', error)
      return { success: false, error: error.message }
    }
  }

  // Запрос номера телефона через Telegram WebApp API
  const requestTelegramContact = async (): Promise<{ success: boolean; phone?: string; error?: string }> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.Telegram?.WebApp) {
        resolve({ success: false, error: 'Telegram WebApp not available' })
        return
      }

      const tg = window.Telegram.WebApp as any

      // Проверяем поддерживается ли запрос контакта
      if (!tg.requestContact) {
        resolve({ success: false, error: 'Contact request not supported' })
        return
      }

      try {
        console.log('📞 Requesting contact from Telegram...')

        // Устанавливаем обработчик события
        const handleContactReceived = (event: any) => {
          console.log('📞 Contact received:', event)

          if (event?.contact?.phone_number) {
            // Форматируем номер (добавляем + если нет)
            let phone = event.contact.phone_number
            if (!phone.startsWith('+')) {
              phone = '+' + phone
            }

            resolve({ success: true, phone })
          } else {
            resolve({ success: false, error: 'No phone number in contact' })
          }

          // Убираем обработчик после получения
          tg.offEvent('contactRequested', handleContactReceived)
        }

        // Обработчик для отказа пользователя
        const handleContactCancelled = () => {
          console.log('📞 Contact request cancelled by user')
          resolve({ success: false, error: 'User cancelled contact sharing' })
          tg.offEvent('contactRequested', handleContactReceived)
          tg.offEvent('contactCancelled', handleContactCancelled)
        }

        // Устанавливаем обработчики
        tg.onEvent('contactRequested', handleContactReceived)
        tg.onEvent('contactCancelled', handleContactCancelled)

        // Запрашиваем контакт
        tg.requestContact()

        // Таймаут на случай если ничего не произойдет
        setTimeout(() => {
          resolve({ success: false, error: 'Contact request timeout' })
          tg.offEvent('contactRequested', handleContactReceived)
          tg.offEvent('contactCancelled', handleContactCancelled)
        }, 30000) // 30 секунд

      } catch (error: any) {
        console.error('❌ Error requesting contact:', error)
        resolve({ success: false, error: error.message })
      }
    })
  }

  return {
    // Состояние
    telegramUser: readonly(telegramUser),
    isAuthenticated: readonly(isAuthenticated),
    isLoading: readonly(isLoading),
    profile: readonly(profile),

    // Вычисляемые свойства
    userId,
    userName,

    // Методы
    signInWithTelegram,
    signOut,
    checkAuth,
    initAuth,
    updatePhone,
    requestTelegramContact,
    getTelegramInitData,
    parseInitData
  }
}
