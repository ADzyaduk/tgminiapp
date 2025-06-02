<template>
    <div class="fixed bottom-4 right-4 z-50">
        <UCard class="w-80 bg-white/95 backdrop-blur">
            <template #header>
                <h3 class="text-sm font-medium">🧪 Тестирование авторизации</h3>
            </template>

            <div class="space-y-3">
                <!-- Текущий статус -->
                <div class="text-xs bg-gray-50 p-2 rounded">
                    <p><strong>Supabase:</strong> {{ supabaseStatus }}</p>
                    <p><strong>Telegram:</strong> {{ telegramStatus }}</p>
                </div>

                <!-- Кнопки управления -->
                <div class="grid grid-cols-1 gap-2">
                    <UButton @click="signOutSupabase" variant="outline" color="warning" size="xs"
                        :loading="loadingSupabase" block>
                        🚪 Выйти из Supabase
                    </UButton>

                    <UButton @click="signOutTelegram" variant="outline" color="error" size="xs"
                        :loading="loadingTelegram" block>
                        🔐 Выйти из Telegram Auth
                    </UButton>

                    <UButton @click="clearAllData" variant="solid" color="error" size="xs" :loading="loadingClear"
                        block>
                        🗑️ Очистить всё
                    </UButton>

                    <UButton @click="testTelegramAuth" variant="solid" color="primary" size="xs" :loading="loadingTest"
                        block>
                        🎯 Тест Telegram Auth
                    </UButton>

                    <UButton @click="makeDevAdmin" variant="solid" color="error" size="xs" :loading="loadingAdmin"
                        block>
                        👑 Сделать Dev админом
                    </UButton>
                </div>

                <!-- Отладочная информация -->
                <details class="text-xs">
                    <summary class="cursor-pointer text-gray-600">🔍 Debug Info</summary>
                    <div class="mt-2 space-y-1 bg-gray-50 p-2 rounded">
                        <p><strong>InitData:</strong> {{ !!initData }}</p>
                        <p><strong>Cookies:</strong> {{ cookiesInfo }}</p>
                        <p v-if="initData" class="break-all">
                            <strong>Data:</strong> {{ initData.substring(0, 50) }}...
                        </p>
                    </div>
                </details>
            </div>
        </UCard>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '#imports'

// Composables
const { user: supabaseUser, signOut: supabaseSignOut } = useAuth()
const {
    isAuthenticated: telegramAuth,
    signOut: telegramSignOut,
    getTelegramInitData,
    signInWithTelegram
} = useTelegramAuth()

const toast = useToast()

// Состояния загрузки
const loadingSupabase = ref(false)
const loadingTelegram = ref(false)
const loadingClear = ref(false)
const loadingTest = ref(false)
const loadingAdmin = ref(false)

// Статусы
const supabaseStatus = computed(() => {
    return supabaseUser.value ? `✅ ${supabaseUser.value.email}` : '❌ Не авторизован'
})

const telegramStatus = computed(() => {
    return telegramAuth.value ? '✅ Авторизован' : '❌ Не авторизован'
})

const initData = computed(() => {
    return getTelegramInitData()
})

const cookiesInfo = computed(() => {
    if (typeof document === 'undefined') return 'N/A'
    const cookies = document.cookie.split(';').length
    return `${cookies} cookie(s)`
})

// Методы
const signOutSupabase = async () => {
    try {
        loadingSupabase.value = true
        await supabaseSignOut()
        toast.add({
            title: 'Выход из Supabase',
            description: 'Вы вышли из Supabase аккаунта',
            color: 'success'
        })
    } catch (error: any) {
        toast.add({
            title: 'Ошибка',
            description: error.message,
            color: 'error'
        })
    } finally {
        loadingSupabase.value = false
    }
}

const signOutTelegram = async () => {
    try {
        loadingTelegram.value = true
        await telegramSignOut()
        toast.add({
            title: 'Выход из Telegram Auth',
            description: 'JWT токены очищены',
            color: 'success'
        })
    } catch (error: any) {
        toast.add({
            title: 'Ошибка',
            description: error.message,
            color: 'error'
        })
    } finally {
        loadingTelegram.value = false
    }
}

const clearAllData = async () => {
    try {
        loadingClear.value = true

        // Очищаем Supabase
        await supabaseSignOut()

        // Очищаем Telegram Auth
        await telegramSignOut()

        // Очищаем localStorage и sessionStorage
        if (typeof window !== 'undefined') {
            localStorage.clear()
            sessionStorage.clear()
        }

        toast.add({
            title: 'Данные очищены',
            description: 'Все данные авторизации удалены',
            color: 'success'
        })

        // Перезагружаем страницу
        setTimeout(() => {
            window.location.reload()
        }, 1000)

    } catch (error: any) {
        toast.add({
            title: 'Ошибка',
            description: error.message,
            color: 'error'
        })
    } finally {
        loadingClear.value = false
    }
}

const testTelegramAuth = async () => {
    try {
        loadingTest.value = true

        const result = await signInWithTelegram()

        if (result.success) {
            toast.add({
                title: 'Тест успешен!',
                description: 'Telegram авторизация работает',
                color: 'success'
            })
        } else {
            toast.add({
                title: 'Тест не пройден',
                description: result.error || 'Ошибка авторизации',
                color: 'error'
            })
        }
    } catch (error: any) {
        toast.add({
            title: 'Ошибка теста',
            description: error.message,
            color: 'error'
        })
    } finally {
        loadingTest.value = false
    }
}

const makeDevAdmin = async () => {
    try {
        loadingAdmin.value = true

        const result = await $fetch('/api/admin/set-dev-admin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })

        if (result.success) {
            toast.add({
                title: 'Успешно!',
                description: 'Dev пользователь теперь админ',
                color: 'success'
            })

            // Обновляем страницу чтобы увидеть изменения
            setTimeout(() => {
                window.location.reload()
            }, 1000)
        } else {
            throw new Error(result.error)
        }
    } catch (error: any) {
        toast.add({
            title: 'Ошибка',
            description: error.message || 'Не удалось установить роль админа',
            color: 'error'
        })
    } finally {
        loadingAdmin.value = false
    }
}
</script>
