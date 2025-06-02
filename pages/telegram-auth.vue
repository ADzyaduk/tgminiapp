<template>
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <!-- Загрузка -->
        <div v-if="isLoading" class="flex items-center justify-center min-h-screen">
            <UCard class="w-full max-w-md">
                <div class="text-center space-y-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p class="text-gray-600">Инициализация...</p>
                </div>
            </UCard>
        </div>

        <!-- Не авторизован -->
        <div v-else-if="!isAuthenticated" class="flex items-center justify-center min-h-screen">
            <UCard class="w-full max-w-md">
                <template #header>
                    <h1 class="text-2xl font-bold text-center">🚢 Бронирование лодок</h1>
                </template>

                <div class="space-y-4 text-center">
                    <p class="text-gray-600">
                        Добро пожаловать! Для использования приложения необходима авторизация через Telegram.
                    </p>

                    <div class="bg-blue-50 p-4 rounded-lg">
                        <div class="flex items-start space-x-3">
                            <Icon name="i-heroicons-information-circle" class="text-blue-600 mt-0.5" />
                            <div class="text-sm text-blue-800">
                                <p class="font-medium">Почему через Telegram?</p>
                                <ul class="mt-2 space-y-1 text-left">
                                    <li>• Безопасная авторизация</li>
                                    <li>• Уведомления о бронированиях</li>
                                    <li>• Быстрый доступ к приложению</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <UButton @click="handleManualAuth" block :loading="authLoading" color="primary">
                        🔐 Авторизоваться
                    </UButton>

                    <!-- Отладочная информация для разработки -->
                    <div v-if="isDev" class="mt-4 p-3 bg-yellow-50 rounded border text-xs">
                        <p class="font-bold text-yellow-800">Режим разработки</p>
                        <p class="text-yellow-700 mt-1">
                            InitData доступна: {{ !!initDataRaw }}
                        </p>
                        <p v-if="initDataRaw" class="text-yellow-700 break-all">
                            {{ initDataRaw.substring(0, 100) }}...
                        </p>
                    </div>
                </div>
            </UCard>
        </div>

        <!-- Авторизован но нужен номер телефона -->
        <div v-else-if="needsPhone" class="flex items-center justify-center min-h-screen">
            <TelegramPhoneInput :show-phone-input="true" @success="handlePhoneSuccess" @skip="handlePhoneSkip" />
        </div>

        <!-- Авторизован и готов к работе -->
        <div v-else class="container mx-auto">
            <UCard class="w-full max-w-2xl mx-auto">
                <template #header>
                    <div class="flex items-center justify-between">
                        <h1 class="text-2xl font-bold">🚢 Бронирование лодок</h1>
                        <UButton @click="handleSignOut" variant="ghost" color="error" size="sm">
                            Выйти
                        </UButton>
                    </div>
                </template>

                <div class="space-y-6">
                    <!-- Информация о пользователе -->
                    <div class="bg-green-50 p-4 rounded-lg">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-green-200 rounded-full flex items-center justify-center">
                                <Icon name="i-heroicons-user" class="text-green-700" />
                            </div>
                            <div>
                                <h3 class="font-medium text-green-900">
                                    Добро пожаловать, {{ userName }}!
                                </h3>
                                <p class="text-sm text-green-700">
                                    Telegram ID: {{ userId }}
                                </p>
                                <p v-if="profile?.phone" class="text-sm text-green-700">
                                    Телефон: {{ profile.phone }}
                                </p>
                                <p class="text-sm text-green-700">
                                    Роль: {{ profile?.role || 'не указана' }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Действия -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <UButton to="/boats" block size="lg" color="primary">
                            🚤 Выбрать лодку
                        </UButton>

                        <UButton to="/bookings" block size="lg" variant="outline">
                            📋 Мои бронирования
                        </UButton>
                    </div>

                    <!-- Быстрые действия -->
                    <div class="space-y-3">
                        <h3 class="font-medium text-gray-900">Быстрые действия:</h3>

                        <UButton v-if="!profile?.phone" @click="needsPhone = true" variant="soft" color="warning" block>
                            📞 Добавить номер телефона
                        </UButton>

                        <UButton to="/admin" variant="soft" color="secondary" block v-if="isAdmin">
                            ⚙️ Панель администратора
                        </UButton>
                    </div>
                </div>
            </UCard>
        </div>

        <!-- Компонент тестирования (только в development) -->
        <TestAuthControls v-if="isDev" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '#imports'

// Метаданные страницы
definePageMeta({
    layout: false, // Используем собственную разметку
    title: 'Telegram Auth Demo'
})

const {
    telegramUser,
    isAuthenticated,
    isLoading,
    profile,
    userId,
    userName,
    signInWithTelegram,
    signOut,
    getTelegramInitData
} = useTelegramAuth()

const toast = useToast()

// Локальное состояние
const authLoading = ref(false)
const needsPhone = ref(false)

// Проверяем нужен ли номер телефона
watch([isAuthenticated, profile], ([auth, prof]) => {
    if (auth && prof && !prof.phone) {
        needsPhone.value = true
    }
}, { immediate: true })

// Вычисляемые свойства
const isDev = computed(() => {
    const config = useRuntimeConfig()
    return config.public.isTelegramDevMode
})

const isAdmin = computed(() => {
    return profile.value?.role === 'admin'
})

const initDataRaw = computed(() => {
    return getTelegramInitData()
})

// Методы
const handleManualAuth = async () => {
    try {
        authLoading.value = true

        const result = await signInWithTelegram()

        if (result.success) {
            toast.add({
                title: 'Успешно!',
                description: 'Вы авторизованы через Telegram',
                color: 'success'
            })
        } else {
            toast.add({
                title: 'Ошибка авторизации',
                description: result.error || 'Не удалось авторизоваться',
                color: 'error'
            })
        }
    } catch (error: any) {
        toast.add({
            title: 'Ошибка',
            description: error.message || 'Произошла ошибка',
            color: 'error'
        })
    } finally {
        authLoading.value = false
    }
}

const handleSignOut = async () => {
    try {
        await signOut()
        toast.add({
            title: 'Выход выполнен',
            description: 'Вы вышли из системы',
            color: 'info'
        })
    } catch (error) {
        console.error('Sign out error:', error)
    }
}

const handlePhoneSuccess = (phone: string) => {
    needsPhone.value = false
    toast.add({
        title: 'Отлично!',
        description: `Номер ${phone} сохранен`,
        color: 'success'
    })
}

const handlePhoneSkip = () => {
    needsPhone.value = false
    toast.add({
        title: 'Пропущено',
        description: 'Вы можете добавить номер телефона позже',
        color: 'info'
    })
}
</script>
