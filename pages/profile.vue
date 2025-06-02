<template>
    <div class="container mx-auto p-4 max-w-4xl">
        <!-- Хедер профиля -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold mb-2">Профиль пользователя</h1>
            <p>Управление личными данными и настройками аккаунта</p>
        </div>

        <!-- Состояние загрузки -->
        <div v-if="isLoading" class="flex justify-center items-center h-64">
            <div class="text-center">
                <USkeleton class="h-8 w-8 mx-auto mb-3 rounded-full" />
                <p class="ml-3">Загрузка профиля...</p>
            </div>
        </div>

        <!-- Неавторизованный пользователь -->
        <div v-else-if="!isAuthenticated" class="text-center py-16">
            <div class="rounded-lg p-8 border">
                <Icon name="i-heroicons-user-circle" class="text-6xl mx-auto mb-4" />
                <h2 class="text-xl font-semibold mb-2">Войдите в систему</h2>
                <p class="mb-6">Для просмотра профиля необходимо авторизоваться через Telegram</p>
                <UButton to="/telegram-auth" color="primary" size="lg">
                    Войти через Telegram
                </UButton>
            </div>
        </div>

        <!-- Основной интерфейс профиля -->
        <div v-else class="space-y-8">
            <!-- Карточка с основной информацией -->
            <UCard>
                <template #header>
                    <div class="flex items-center space-x-4">
                        <!-- Аватар пользователя -->
                        <div class="relative">
                            <UAvatar :src="userAvatar" :alt="profile?.name || 'User Avatar'" size="2xl" />
                            <!-- Индикатор онлайн статуса -->
                            <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 rounded-full">
                            </div>
                        </div>

                        <div class="flex-1">
                            <h2 class="text-2xl font-bold">{{ profile?.name || 'Пользователь' }}</h2>
                            <p>{{ getRoleLabel(profile?.role) }}</p>
                            <div class="flex items-center mt-2 space-x-4">
                                <UBadge :color="getRoleBadgeColor(profile?.role)" variant="soft">
                                    {{ getRoleLabel(profile?.role) }}
                                </UBadge>
                            </div>
                        </div>

                        <UButton v-if="!isEditing" @click="startEditing" color="primary" variant="outline"
                            icon="i-heroicons-pencil">
                            Редактировать
                        </UButton>
                    </div>
                </template>

                <!-- Форма редактирования -->
                <div v-if="isEditing" class="space-y-6">
                    <UFormField label="Имя" required>
                        <UInput v-model="editForm.name" placeholder="Введите ваше имя" icon="i-heroicons-user" />
                    </UFormField>

                    <UFormField :label="phoneFieldLabel" :required="isPhoneRequired">
                        <UInput v-model="editForm.phone" placeholder="+7 (900) 123-45-67" icon="i-heroicons-phone"
                            @input="handlePhoneInput" />
                    </UFormField>

                    <!-- Предупреждение для ролей -->
                    <UAlert v-if="isPhoneRequired && !editForm.phone" color="warning" variant="soft"
                        title="Номер телефона обязателен" :description="getPhoneRequirementText()" />

                    <!-- Кнопки действий -->
                    <div class="flex gap-3 pt-4 border-t">
                        <UButton @click="saveProfile" color="primary" :loading="isSaving" :disabled="!canSave">
                            Сохранить изменения
                        </UButton>
                        <UButton @click="cancelEditing" variant="ghost">
                            Отмена
                        </UButton>
                    </div>
                </div>

                <!-- Просмотр данных -->
                <div v-if="!isEditing" class="space-y-4">
                    <!-- Отладочная информация (временно) -->
                    <div v-if="false" class="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm mb-4">
                        <p><strong>Debug Info:</strong></p>
                        <p>Profile loaded: {{ !!profile }}</p>
                        <p>Profile name: "{{ profile?.name }}"</p>
                        <p>Profile phone: "{{ profile?.phone }}"</p>
                        <p>isEditing: {{ isEditing }}</p>
                        <p>isAuthenticated: {{ isAuthenticated }}</p>
                        <p>isLoading: {{ isLoading }}</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="p-4 rounded-lg border">
                            <label class="block text-sm font-medium mb-2">Имя</label>
                            <div class="text-lg font-semibold">
                                {{ profile?.name || 'Не указано' }}
                            </div>
                            <p v-if="!profile?.name" class="text-xs mt-1">
                                Добавьте имя в настройках профиля
                            </p>
                        </div>

                        <div class="p-4 rounded-lg border">
                            <label class="block text-sm font-medium mb-2">Телефон</label>
                            <div class="flex items-center space-x-2">
                                <div class="text-lg font-semibold">
                                    {{ profile?.phone || 'Не указано' }}
                                </div>
                                <UBadge v-if="isPhoneRequired && !profile?.phone" color="warning" variant="soft"
                                    size="xs">
                                    Обязательно
                                </UBadge>
                            </div>
                        </div>

                        <div class="p-4 rounded-lg border">
                            <label class="block text-sm font-medium mb-2">Роль</label>
                            <UBadge :color="getRoleBadgeColor(profile?.role)" variant="soft" size="lg">
                                {{ getRoleLabel(profile?.role) }}
                            </UBadge>
                        </div>
                    </div>

                    <!-- Статистика пользователя -->
                    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-4 rounded-lg text-center border">
                            <div class="text-2xl font-bold">{{ userStats.totalBookings }}</div>
                            <div class="text-sm">Всего бронирований</div>
                        </div>
                        <div class="p-4 rounded-lg text-center border">
                            <div class="text-2xl font-bold">{{ userStats.confirmedBookings }}</div>
                            <div class="text-sm">Подтвержденных</div>
                        </div>
                        <div class="p-4 rounded-lg text-center border">
                            <div class="text-2xl font-bold">{{ userStats.totalSpent }}₽</div>
                            <div class="text-sm">Потрачено</div>
                        </div>
                    </div>
                </div>
            </UCard>

            <!-- Быстрые действия -->
            <UCard>
                <template #header>
                    <h3 class="text-lg font-semibold">Быстрые действия</h3>
                </template>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <UButton to="/" color="primary" variant="soft" block>
                        <template #leading>
                            <Icon name="i-heroicons-home" />
                        </template>
                        Забронировать лодку
                    </UButton>

                    <UButton to="/bookings" color="primary" variant="soft" block>
                        <template #leading>
                            <Icon name="i-heroicons-calendar" />
                        </template>
                        Мои бронирования
                    </UButton>

                    <UButton to="/group-tours" color="primary" variant="soft" block>
                        <template #leading>
                            <Icon name="i-heroicons-user-group" />
                        </template>
                        Групповые туры
                    </UButton>

                    <!-- Дополнительные действия для агентов/менеджеров -->
                    <template v-if="isAgentOrManager">
                        <UButton to="/admin" color="primary" variant="soft" block>
                            <template #leading>
                                <Icon name="i-heroicons-cog-6-tooth" />
                            </template>
                            Панель управления
                        </UButton>

                        <UButton @click="showStatsModal = true" color="primary" variant="soft" block>
                            <template #leading>
                                <Icon name="i-heroicons-chart-bar" />
                            </template>
                            Статистика
                        </UButton>
                    </template>
                </div>
            </UCard>

            <!-- Настройки уведомлений -->
            <UCard>
                <template #header>
                    <h3 class="text-lg font-semibold">Настройки уведомлений</h3>
                </template>

                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="font-medium">Уведомления о бронированиях</h4>
                            <p class="text-sm">Получать уведомления о новых бронированиях в Telegram</p>
                        </div>
                        <UCheckbox v-model="notificationSettings.bookings" />
                    </div>

                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="font-medium">Напоминания</h4>
                            <p class="text-sm">Напоминания о предстоящих поездках</p>
                        </div>
                        <UCheckbox v-model="notificationSettings.reminders" />
                    </div>

                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="font-medium">Новости и акции</h4>
                            <p class="text-sm">Получать информацию о скидках и новинках</p>
                        </div>
                        <UCheckbox v-model="notificationSettings.promotions" />
                    </div>
                </div>
            </UCard>
        </div>

        <!-- Модальное окно со статистикой (для агентов/менеджеров) -->
        <UModal v-model:open="showStatsModal" title="Подробная статистика">
            <template #body>
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="text-center p-4 rounded-lg border">
                            <div class="text-xl font-bold">{{ agentStats.thisMonth }}</div>
                            <div class="text-sm">Бронирований в этом месяце</div>
                        </div>
                        <div class="text-center p-4 rounded-lg border">
                            <div class="text-xl font-bold">{{ agentStats.revenue }}₽</div>
                            <div class="text-sm">Доход за месяц</div>
                        </div>
                    </div>
                    <p class="text-sm">
                        Данные обновляются в реальном времени
                    </p>
                </div>
            </template>

            <template #footer>
                <UButton @click="showStatsModal = false" variant="outline" block>
                    Закрыть
                </UButton>
            </template>
        </UModal>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

// Метаданные страницы
definePageMeta({
    title: 'Профиль пользователя',
    requiresAuth: true
})

// Composables
const { profile, isAuthenticated, isLoading, updatePhone, updateProfile } = useTelegramAuth()
const toast = useToast()

// Локальное состояние
const isEditing = ref(false)
const isSaving = ref(false)
const showStatsModal = ref(false)

// Форма редактирования
const editForm = ref({
    name: '',
    phone: ''
})

// Настройки уведомлений
const notificationSettings = ref({
    bookings: true,
    reminders: true,
    promotions: false
})

// Статистика пользователя
const userStats = ref({
    totalBookings: 0,
    confirmedBookings: 0,
    totalSpent: 0
})

// Статистика для агентов
const agentStats = ref({
    thisMonth: 0,
    revenue: 0
})

// Вычисляемые свойства
const userAvatar = computed(() => {
    // Если есть photo_url из Telegram
    if (profile.value?.photo_url) {
        return profile.value.photo_url
    }

    // Генерируем аватар на основе имени
    if (profile.value?.name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.value.name)}&size=128&background=4f46e5&color=ffffff`
    }

    // Fallback аватар
    return `https://ui-avatars.com/api/?name=User&size=128&background=6b7280&color=ffffff`
})

const isAgentOrManager = computed(() => {
    const role = profile.value?.role
    return role === 'agent' || role === 'manager' || role === 'admin'
})

const isPhoneRequired = computed(() => {
    const role = profile.value?.role
    return role === 'agent' || role === 'manager'
})

const phoneFieldLabel = computed(() => {
    return isPhoneRequired.value ? 'Номер телефона *' : 'Номер телефона'
})

const canSave = computed(() => {
    if (!editForm.value.name?.trim()) return false
    if (isPhoneRequired.value && !editForm.value.phone?.trim()) return false
    return true
})

// Методы для работы с ролями
const getRoleLabel = (role: string) => {
    switch (role) {
        case 'admin': return 'Администратор'
        case 'manager': return 'Менеджер'
        case 'agent': return 'Агент'
        case 'user': return 'Пользователь'
        default: return 'Пользователь'
    }
}

const getRoleBadgeColor = (role: string) => {
    switch (role) {
        case 'admin': return 'error'
        case 'manager': return 'secondary'
        case 'agent': return 'primary'
        case 'user': return 'success'
        default: return 'neutral'
    }
}

const getPhoneRequirementText = () => {
    const role = profile.value?.role
    if (role === 'agent') {
        return 'Как агент, вы должны указать номер телефона для связи с клиентами при бронировании.'
    }
    if (role === 'manager') {
        return 'Как менеджер, вы должны указать номер телефона для координации работы.'
    }
    return ''
}

// Форматирование телефона
const handlePhoneInput = (event: Event) => {
    const input = event.target as HTMLInputElement
    let value = input.value.replace(/\D/g, '')

    if (value.startsWith('7')) {
        value = value.substring(1)
    }

    if (value.length > 0) {
        if (value.length <= 3) {
            input.value = `+7 (${value}`
        } else if (value.length <= 6) {
            input.value = `+7 (${value.substring(0, 3)}) ${value.substring(3)}`
        } else if (value.length <= 8) {
            input.value = `+7 (${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`
        } else {
            input.value = `+7 (${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6, 8)}-${value.substring(8, 10)}`
        }
    }

    editForm.value.phone = input.value
}

// Редактирование профиля
const startEditing = () => {
    editForm.value = {
        name: profile.value?.name || '',
        phone: profile.value?.phone || ''
    }
    isEditing.value = true
}

const cancelEditing = () => {
    isEditing.value = false
    editForm.value = {
        name: '',
        phone: ''
    }
}

const saveProfile = async () => {
    try {
        isSaving.value = true

        // Подготавливаем данные для обновления
        const updates: { name?: string; phone?: string } = {}

        if (editForm.value.name !== profile.value?.name) {
            updates.name = editForm.value.name
        }

        // Обновляем профиль если есть изменения
        if (Object.keys(updates).length > 0) {
            const profileResult = await updateProfile(updates)
            if (!profileResult.success) {
                throw new Error(profileResult.error || 'Не удалось обновить профиль')
            }
        }

        // Обновляем номер телефона если изменился
        if (editForm.value.phone !== profile.value?.phone) {
            const phoneResult = await updatePhone(editForm.value.phone)
            if (!phoneResult.success) {
                throw new Error(phoneResult.error || 'Не удалось обновить номер телефона')
            }
        }

        toast.add({
            title: 'Успешно!',
            description: 'Профиль обновлен',
            color: 'success'
        })

        isEditing.value = false

    } catch (error: any) {
        console.error('Save profile error:', error)
        toast.add({
            title: 'Ошибка',
            description: error.message || 'Не удалось сохранить изменения',
            color: 'error'
        })
    } finally {
        isSaving.value = false
    }
}

// Загрузка статистики
const loadUserStats = async () => {
    try {
        const result = await $fetch('/api/user/stats') as any

        if (result.success) {
            userStats.value = result.stats

            if (isAgentOrManager.value) {
                agentStats.value = result.agentStats
            }
        }
    } catch (error) {
        console.error('Error loading user stats:', error)
        // Используем заглушки в случае ошибки
        userStats.value = {
            totalBookings: 0,
            confirmedBookings: 0,
            totalSpent: 0
        }

        if (isAgentOrManager.value) {
            agentStats.value = {
                thisMonth: 0,
                revenue: 0
            }
        }
    }
}

// Инициализация
onMounted(() => {
    loadUserStats()
})

// Отслеживание изменений профиля
watch(profile, (newProfile) => {
    if (newProfile && isPhoneRequired.value && !newProfile.phone) {
        toast.add({
            title: 'Требуется номер телефона',
            description: 'Пожалуйста, добавьте номер телефона в профиль',
            color: 'warning'
        })
    }
}, { immediate: true })
</script>
