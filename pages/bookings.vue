<template>
    <div class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-6">Мои бронирования</h1>

        <div v-if="!isAuthenticated" class="text-center py-8">
            <p class="mb-4">Войдите через Telegram чтобы увидеть свои бронирования</p>
            <UButton to="/telegram-auth" color="primary">
                Войти через Telegram
            </UButton>
        </div>

        <div v-else-if="loading" class="text-center py-8">
            <UProgress animation="carousel" />
            <p class="mt-2">Загрузка бронирований...</p>
        </div>

        <div v-else-if="bookings.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-calendar" class="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 class="text-lg font-medium mb-2">Нет бронирований</h3>
            <p class="text-gray-600 mb-4">У вас пока нет активных бронирований</p>
            <UButton to="/" color="primary">
                Посмотреть лодки
            </UButton>
        </div>

        <div v-else class="space-y-4">
            <UCard v-for="booking in bookings" :key="booking.id">
                <div class="p-4">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-semibold">{{ booking.boat_name || 'Лодка' }}</h3>
                        <UBadge :color="getStatusColor(booking.status)" variant="subtle">
                            {{ getStatusText(booking.status) }}
                        </UBadge>
                    </div>

                    <div class="text-sm text-gray-600 space-y-1">
                        <p><strong>Дата:</strong> {{ formatDate(booking.start_time) }}</p>
                        <p><strong>Время:</strong> {{ formatTime(booking.start_time) }} - {{
                            formatTime(booking.end_time) }}</p>
                        <p><strong>Цена:</strong> {{ formatPrice(booking.price) }}</p>
                        <p v-if="booking.guest_name"><strong>Имя:</strong> {{ booking.guest_name }}</p>
                        <p v-if="booking.guest_phone"><strong>Телефон:</strong> {{ booking.guest_phone }}</p>
                    </div>
                </div>
            </UCard>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

definePageMeta({
    title: 'Мои бронирования'
})

const { profile, isAuthenticated } = useTelegramAuth()

const bookings = ref<any[]>([])
const loading = ref(false)

const loadBookings = async () => {
    if (!profile.value?.telegram_id) return

    try {
        loading.value = true

        // TODO: Создать API для получения бронирований пользователя
        const result = await $fetch('/api/user/bookings', {
            method: 'GET'
        }) as any

        bookings.value = result.data || []
    } catch (error) {
        console.error('Error loading bookings:', error)
        useToast().add({
            title: 'Ошибка',
            description: 'Не удалось загрузить бронирования',
            color: 'error'
        })
    } finally {
        loading.value = false
    }
}

// Helper functions
const formatDate = (dateString: string) => {
    try {
        return format(parseISO(dateString), 'dd MMMM yyyy', { locale: ru })
    } catch (e) {
        return dateString
    }
}

const formatTime = (dateString: string) => {
    try {
        return format(parseISO(dateString), 'HH:mm', { locale: ru })
    } catch (e) {
        return dateString
    }
}

const formatPrice = (price: number) => {
    return `${price.toLocaleString('ru-RU')} ₽`
}

const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
        'pending': 'Ожидает подтверждения',
        'confirmed': 'Подтверждено',
        'completed': 'Завершено',
        'cancelled': 'Отменено'
    }
    return statusMap[status] || status
}

const getStatusColor = (status: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' => {
    const colorMap = {
        'pending': 'warning' as const,
        'confirmed': 'success' as const,
        'completed': 'neutral' as const,
        'cancelled': 'error' as const
    }
    return colorMap[status as keyof typeof colorMap] || 'neutral'
}

onMounted(() => {
    if (isAuthenticated.value) {
        loadBookings()
    }
})
</script>
