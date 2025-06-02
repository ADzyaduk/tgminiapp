<template>
  <div class="container mx-auto p-4">
    <!-- Заголовок -->
    <div class="flex justify-between items-center mb-6 animate-fade-in-down">
      <div>
        <h1 class="text-2xl font-bold">Групповые поездки</h1>
        <p class="text-gray-500 mt-1">Найдите и забронируйте места в групповых поездках</p>
      </div>
    </div>

    <!-- Основной контент -->
    <div class="space-y-6">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="text-xl text-primary" />
            <h2 class="text-xl font-semibold">Доступные групповые поездки</h2>
          </div>
        </template>

        <div class="p-4">
          <GroupTripList @booking-success="onBookingSuccess" />
        </div>
      </UCard>

      <UCard v-if="userBookings.length > 0">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-ticket" class="text-xl text-primary" />
            <h2 class="text-xl font-semibold">Мои бронирования</h2>
          </div>
        </template>

        <div class="p-4">
          <div class="space-y-4">
            <UCard v-for="booking in userBookings" :key="booking.id" class="border-l-4" :class="{
              'border-blue-500': booking.status === 'confirmed',
              'border-green-500': booking.status === 'completed',
              'border-red-500': booking.status === 'cancelled'
            }">
              <div class="flex flex-col md:flex-row justify-between">
                <div class="flex-1">
                  <h3 class="font-medium">{{ booking.group_trips?.name || 'Групповая поездка' }}</h3>
                  <p class="text-sm text-gray-500">
                    {{ formatDate(booking.group_trips?.start_time) }},
                    {{ formatTime(booking.group_trips?.start_time) }} - {{ formatTime(booking.group_trips?.end_time) }}
                  </p>

                  <div class="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <span class="text-sm text-gray-500">Гость:</span>
                      <div>{{ booking.guest_name }}</div>
                    </div>
                    <div>
                      <span class="text-sm text-gray-500">Билеты:</span>
                      <div>{{ booking.adult_count }} взр., {{ booking.child_count }} дет.</div>
                    </div>
                    <div>
                      <span class="text-sm text-gray-500">Итого:</span>
                      <div class="font-medium">{{ formatPrice(booking.total_price) }}</div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 mt-4 md:mt-0">
                  <UBadge :color="getStatusColor(booking.status)" variant="subtle">
                    {{ getStatusText(booking.status) }}
                  </UBadge>

                  <!-- Inline cancellation confirmation -->
                  <div v-if="booking.status === 'confirmed'">
                    <div v-if="bookingToCancel?.id === booking.id" class="flex gap-2">
                      <UButton color="error" variant="soft" size="sm" :loading="isCancelling" @click="cancelBooking">
                        Подтвердить
                      </UButton>
                      <UButton color="neutral" variant="soft" size="sm" @click="bookingToCancel = null">
                        Отмена
                      </UButton>
                    </div>
                    <UButton v-else color="error" variant="soft" icon="i-heroicons-x-mark" size="sm"
                      @click="confirmCancelBooking(booking)">
                      Отменить
                    </UButton>
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

definePageMeta({
  layout: 'default'
})

// Types
interface GroupTrip {
  id: string
  name: string
  start_time: string
  end_time: string
}

interface UserBooking {
  id: string
  status: 'confirmed' | 'completed' | 'cancelled'
  guest_name: string
  adult_count: number
  child_count: number
  total_price: number
  group_trips?: GroupTrip
}

const { isAuthenticated } = useTelegramAuth()

// State
const userBookings = ref<UserBooking[]>([])
const bookingToCancel = ref<UserBooking | null>(null)
const isCancelling = ref(false)

// Load user bookings - переделаем под новую авторизацию
const loadUserBookings = async () => {
  try {
    if (!isAuthenticated.value) return

    // TODO: Заменить на новый API с Telegram auth
    console.log('🔄 Загрузка бронирований пользователя...')

    // Временно заглушка
    userBookings.value = []

  } catch (error) {
    console.error('Error loading user bookings:', error)
    useToast().add({
      title: 'Ошибка',
      description: 'Не удалось загрузить ваши бронирования',
      color: 'error'
    })
  }
}

// Helper methods
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return ''
  try {
    return format(parseISO(dateString), 'dd MMMM yyyy', { locale: ru })
  } catch (e) {
    return dateString
  }
}

const formatTime = (dateString: string | undefined) => {
  if (!dateString) return ''
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
    'confirmed': 'Подтверждено',
    'completed': 'Завершено',
    'cancelled': 'Отменено'
  }
  return statusMap[status] || status
}

const getStatusColor = (status: string): 'primary' | 'success' | 'error' | 'neutral' => {
  const colorMap: Record<string, 'primary' | 'success' | 'error' | 'neutral'> = {
    'confirmed': 'primary',
    'completed': 'success',
    'cancelled': 'error'
  }
  return colorMap[status] || 'neutral'
}

// Event handlers
const onBookingSuccess = async (booking: any) => {
  useToast().add({
    title: 'Успешно',
    description: 'Бронирование успешно создано',
    color: 'success'
  })

  // Reload user bookings
  await loadUserBookings()
}

// Cancel booking
const confirmCancelBooking = (booking: UserBooking) => {
  bookingToCancel.value = booking
}

const cancelBooking = async () => {
  if (!bookingToCancel.value) return

  try {
    isCancelling.value = true

    // TODO: Заменить на новый API с Telegram auth
    console.log('🗑️ Отмена бронирования:', bookingToCancel.value.id)

    useToast().add({
      title: 'Успешно',
      description: 'Бронирование отменено',
      color: 'success'
    })

    // Update local state
    const index = userBookings.value.findIndex(b => b.id === bookingToCancel.value?.id)
    if (index !== -1) {
      userBookings.value[index].status = 'cancelled'
    }

    // Close confirmation
    bookingToCancel.value = null

    // Reload user bookings
    await loadUserBookings()
  } catch (error) {
    console.error('Error cancelling booking:', error)
    useToast().add({
      title: 'Ошибка',
      description: 'Не удалось отменить бронирование',
      color: 'error'
    })
  } finally {
    isCancelling.value = false
  }
}

// Load data on mount
onMounted(async () => {
  if (isAuthenticated.value) {
    await loadUserBookings()
  }
})

// Watch for auth changes
watch(isAuthenticated, async (newVal) => {
  if (newVal) {
    await loadUserBookings()
  } else {
    userBookings.value = []
  }
})
</script>
