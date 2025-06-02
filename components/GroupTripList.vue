<template>
    <div>
        <div v-if="loading" class="text-center py-8">
            <UProgress animation="carousel" />
            <p class="mt-2">Загрузка групповых поездок...</p>
        </div>

        <div v-else-if="bookableTrips.length === 0" class="text-center py-8">
            <UIcon name="i-heroicons-user-group" class="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 class="text-lg font-medium mb-2">Нет доступных групповых поездок</h3>
            <p class="text-gray-600">В данный момент нет открытых групповых поездок</p>
        </div>

        <div v-else class="space-y-6">
            <UCard v-for="trip in bookableTrips" :key="trip.id" class="hover:shadow-lg transition-shadow">
                <div class="p-4">
                    <div class="flex flex-col md:flex-row gap-4">
                        <!-- Изображение лодки -->
                        <div class="md:w-48 h-48 flex-shrink-0">
                            <img :src="getBoatImage(trip.boat)" :alt="trip.boat.name"
                                class="w-full h-full object-cover rounded-lg" />
                        </div>

                        <!-- Информация о поездке -->
                        <div class="flex-1">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="text-xl font-semibold">{{ trip.boat.name }}</h3>
                                <UBadge color="primary" variant="subtle">
                                    {{ getGroupStatusText(trip) }}
                                </UBadge>
                            </div>

                            <p v-if="trip.description" class="text-gray-600 mb-3">
                                {{ truncateText(trip.description, 150) }}
                            </p>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div class="flex items-center gap-2">
                                    <span>{{ formatDate(trip.date) }}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-users" />
                                    <span>{{ trip.available_seats }} мест свободно</span>
                                </div>
                                <div v-if="trip.price_per_person" class="flex items-center gap-2">
                                    <UIcon name="i-heroicons-currency-dollar" />
                                    <span>{{ formatPrice(trip.price_per_person) }} за человека</span>
                                </div>
                            </div>

                            <!-- Кнопки действий -->
                            <div class="mt-4 space-y-2">
                                <!-- Кнопка бронирования -->
                                <div>
                                    <UButton v-if="trip.available_seats > 0" @click="toggleBookingForm(trip.id)"
                                        color="primary" block>
                                        Забронировать места
                                    </UButton>
                                    <UButton v-else disabled color="neutral" block>
                                        Мест нет
                                    </UButton>
                                </div>

                                <!-- Админские кнопки -->
                                <div v-if="isAdmin" class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <UButton @click="startEditingSeats(trip)" variant="outline" color="primary"
                                        icon="i-heroicons-pencil" block>
                                        Изменить места
                                    </UButton>
                                    <UButton @click="startTrip(trip)" variant="outline" color="success"
                                        icon="i-heroicons-play" block>
                                        Отправить
                                    </UButton>
                                    <UButton @click="cancelTrip(trip)" variant="outline" color="error"
                                        icon="i-heroicons-x-mark" block>
                                        Отменить поездку
                                    </UButton>
                                </div>
                            </div>

                            <!-- Форма редактирования мест (только для админов) -->
                            <div v-if="isAdmin && editingSeats[trip.id]" class="mt-4">
                                <div class="flex items-center gap-2">
                                    <span>Доступно мест:</span>
                                    <UButton @click="adjustSeats(trip, -1)" size="xs" icon="i-heroicons-minus"
                                        :disabled="editingSeats[trip.id].current <= 0" />
                                    <span class="mx-2 font-medium">{{ editingSeats[trip.id].current }}</span>
                                    <UButton @click="adjustSeats(trip, 1)" size="xs" icon="i-heroicons-plus"
                                        :disabled="editingSeats[trip.id].current >= trip.total_seats" />
                                    <UButton @click="saveSeats(trip)" color="success" size="xs">
                                        Сохранить
                                    </UButton>
                                    <UButton @click="cancelEditingSeats(trip.id)" variant="outline" size="xs">
                                        Отмена
                                    </UButton>
                                </div>
                            </div>

                            <!-- Форма бронирования -->
                            <div v-if="expandedBookingForms[trip.id]" class="mt-4">
                                <GroupTripBookingFormInline :trip="trip" @booking-success="onBookingSuccess"
                                    @cancel="hideBookingForm(trip.id)" />
                            </div>
                        </div>
                    </div>
                </div>
            </UCard>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSupabaseClient } from '#imports'
import { useGroupTripsStore } from '~/stores/groupTrips'
import { useBoatImages } from '~/composables/useBoatImages'
import GroupTripBookingFormInline from './GroupTripBookingFormInline.vue'

// Props
const props = defineProps({
    boatId: {
        type: String,
        default: null
    }
})

const emit = defineEmits(['tripSelected', 'bookingSuccess'])

const supabaseClient = useSupabaseClient()
const toast = useToast()
const groupTripsStore = useGroupTripsStore()

// Auth - используем новую Telegram авторизацию
const { profile, isAuthenticated } = useTelegramAuth()
const isAdmin = computed(() => profile.value?.role === 'admin')

// Состояние
const loading = ref(true)
const editingSeats = ref<Record<string, any>>({})
const expandedBookingForms = ref<Record<string, boolean>>({})

// Computed свойства
const bookableTrips = computed(() => {
    const trips = groupTripsStore.bookableTrips
    return props.boatId ? trips.filter((trip: any) => trip.boat_id === props.boatId) : trips
})

// Загрузка доступных поездок
const loadBookableTrips = async () => {
    try {
        loading.value = true

        if (props.boatId) {
            await groupTripsStore.loadGroupTripsForBoat(props.boatId)
        } else {
            await groupTripsStore.loadAllBookableTrips()
        }
    } catch (error) {
        console.error('Error loading available trips:', error)
        toast.add({
            title: 'Ошибка',
            description: 'Не удалось загрузить список доступных поездок',
            color: 'error'
        })
    } finally {
        loading.value = false
    }
}

// Управление встроенными формами бронирования
const toggleBookingForm = (tripId: string) => {
    expandedBookingForms.value[tripId] = !expandedBookingForms.value[tripId]
}

const hideBookingForm = (tripId: string) => {
    expandedBookingForms.value[tripId] = false
}

const onBookingSuccess = (booking: any) => {
    // Скрыть все формы бронирования
    Object.keys(expandedBookingForms.value).forEach(tripId => {
        expandedBookingForms.value[tripId] = false
    })

    // Обновить список поездок
    loadBookableTrips()

    emit('bookingSuccess', booking)
}

// Вспомогательные функции
const formatDate = (dateString: string) => {
    try {
        return format(parseISO(dateString), 'dd MMMM yyyy', { locale: ru })
    } catch (e) {
        return dateString
    }
}

const formatPrice = (price: number | undefined | null): string => {
    if (price == null || price === undefined) return '0 ₽'
    return `${price.toLocaleString('ru-RU')} ₽`
}

const truncateText = (text: string, maxLength: number) => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
}

const getBoatImage = (boat: any) => {
    if (boat && boat.slug) {
        const { primary } = useBoatImages(boat);
        if (primary.value) return primary.value;
    }
    return '/images/default-boat.jpg';
}

const getGroupStatusText = (trip: any) => {
    const filledPercentage = 100 - (trip.available_seats / trip.total_seats * 100);

    if (filledPercentage >= 90) {
        return 'Группа почти собрана';
    } else if (filledPercentage >= 60) {
        return 'скоро отправление';
    } else if (filledPercentage >= 30) {
        return 'Группа собирается';
    } else {
        return 'Собирается группа';
    }
}

// Инициализация при монтировании
onMounted(() => {
    loadBookableTrips()
})

// Инициализация редактирования мест для поездки
const startEditingSeats = (trip: any) => {
    editingSeats.value[trip.id] = {
        original: trip.available_seats,
        current: trip.available_seats,
        isEditing: true
    }
}

// Изменение локального значения мест
const adjustSeats = (trip: any, delta: number) => {
    if (!editingSeats.value[trip.id]) {
        startEditingSeats(trip)
    }

    const newValue = editingSeats.value[trip.id].current + delta;
    if (newValue >= 0 && newValue <= trip.total_seats) {
        editingSeats.value[trip.id].current = newValue;
    }
}

// Отмена редактирования
const cancelEditingSeats = (tripId: string) => {
    delete editingSeats.value[tripId]
}

// Сохранение изменений мест
const saveSeats = async (trip: any) => {
    const editing = editingSeats.value[trip.id]
    if (!editing || editing.current === editing.original) {
        cancelEditingSeats(trip.id)
        return
    }

    try {
        const seatsToUpdate = parseInt(editing.current);
        if (isNaN(seatsToUpdate)) {
            throw new Error('Количество мест должно быть числом.');
        }

        const { error } = await groupTripsStore.updateTripSeats(trip.id, seatsToUpdate)

        if (error) throw error

        toast.add({
            title: 'Успешно',
            description: `Количество мест изменено на ${seatsToUpdate}`,
            color: 'success'
        })
        cancelEditingSeats(trip.id)
        await loadBookableTrips()
    } catch (error) {
        console.error('Error updating seats:', error)
        toast.add({
            title: 'Ошибка',
            description: 'Не удалось обновить количество мест' + (error instanceof Error ? `: ${error.message}` : ''),
            color: 'error'
        })
    }
}

const startTrip = async (trip: any) => {
    try {
        await groupTripsStore.startTrip(trip.id)
        toast.add({
            title: 'Успешно',
            description: 'Поездка успешно начата',
            color: 'success'
        })
        await loadBookableTrips()
    } catch (error) {
        console.error('Error starting trip:', error)
        toast.add({
            title: 'Ошибка',
            description: 'Не удалось начать поездку' + (error instanceof Error ? `: ${error.message}` : ''),
            color: 'error'
        })
    }
}

const cancelTrip = async (trip: any) => {
    try {
        await groupTripsStore.cancelTrip(trip.id)
        toast.add({
            title: 'Успешно',
            description: 'Поездка успешно отменена',
            color: 'success'
        })
        await loadBookableTrips()
    } catch (error) {
        console.error('Error canceling trip:', error)
        toast.add({
            title: 'Ошибка',
            description: 'Не удалось отменить поездку' + (error instanceof Error ? `: ${error.message}` : ''),
            color: 'error'
        })
    }
}
</script>
