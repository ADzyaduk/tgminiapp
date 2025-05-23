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
            <UCard
              v-for="booking in userBookings"
              :key="booking.id"
              class="border-l-4"
              :class="{
                'border-blue-500': booking.status === 'confirmed',
                'border-green-500': booking.status === 'completed',
                'border-red-500': booking.status === 'cancelled'
              }"
            >
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
                  <UBadge
                    :color="getStatusColor(booking.status)"
                    variant="subtle"
                  >
                    {{ getStatusText(booking.status) }}
                  </UBadge>
                  
                  <UButton
                    v-if="booking.status === 'confirmed'"
                    color="red"
                    variant="soft"
                    icon="i-heroicons-x-mark"
                    size="sm"
                    @click="confirmCancelBooking(booking)"
                  >
                    Отменить
                  </UButton>
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </UCard>
    </div>
    
    <!-- Confirmation modal -->
    <UModal v-model="isConfirmModalOpen">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">Подтверждение отмены</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="isConfirmModalOpen = false"
            />
          </div>
        </template>
        
        <div class="p-4">
          <p>Вы уверены, что хотите отменить бронирование?</p>
          <p class="mt-2 font-medium">
            {{ bookingToCancel?.group_trips?.name || 'Групповая поездка' }}
            <span class="text-sm font-normal text-gray-500">
              ({{ formatDate(bookingToCancel?.group_trips?.start_time) }})
            </span>
          </p>
          <p class="mt-1 text-sm text-red-500">Это действие нельзя отменить.</p>
        </div>
        
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              @click="isConfirmModalOpen = false"
            >
              Нет
            </UButton>
            <UButton
              color="red"
              :loading="isCancelling"
              @click="cancelBooking"
            >
              Да, отменить
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

definePageMeta({
  layout: 'default'
})

const { $supabase } = useNuxtApp()
const user = useSupabaseUser()
const toast = useToast()

// State
const userBookings = ref([])
const isConfirmModalOpen = ref(false)
const bookingToCancel = ref(null)
const isCancelling = ref(false)

// Load user bookings
const loadUserBookings = async () => {
  try {
    if (!user.value) return
    
    const { data, error } = await $supabase
      .from('group_trip_bookings')
      .select('*, group_trips(*)')
      .eq('user_id', user.value.id)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    userBookings.value = data || []
  } catch (error) {
    console.error('Error loading user bookings:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить ваши бронирования',
      color: 'error'
    })
  }
}

// Helper methods
const formatDate = (dateString) => {
  if (!dateString) return ''
  try {
    return format(parseISO(dateString), 'dd MMMM yyyy', { locale: ru })
  } catch (e) {
    return dateString
  }
}

const formatTime = (dateString) => {
  if (!dateString) return ''
  try {
    return format(parseISO(dateString), 'HH:mm', { locale: ru })
  } catch (e) {
    return dateString
  }
}

const formatPrice = (price) => {
  return `${price.toLocaleString('ru-RU')} ₽`
}

const getStatusText = (status) => {
  const statusMap = {
    'confirmed': 'Подтверждено',
    'completed': 'Завершено',
    'cancelled': 'Отменено'
  }
  return statusMap[status] || status
}

const getStatusColor = (status) => {
  const colorMap = {
    'confirmed': 'blue',
    'completed': 'green',
    'cancelled': 'red'
  }
  return colorMap[status] || 'gray'
}

// Event handlers
const onBookingSuccess = async (booking) => {
  toast.add({
    title: 'Успешно',
    description: 'Бронирование успешно создано',
    color: 'success'
  })
  
  // Reload user bookings
  await loadUserBookings()
}

// Cancel booking
const confirmCancelBooking = (booking) => {
  bookingToCancel.value = booking
  isConfirmModalOpen.value = true
}

const cancelBooking = async () => {
  if (!bookingToCancel.value) return
  
  try {
    isCancelling.value = true
    
    const { error } = await $supabase
      .from('group_trip_bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingToCancel.value.id)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Бронирование отменено',
      color: 'success'
    })
    
    // Update local state
    const index = userBookings.value.findIndex(b => b.id === bookingToCancel.value.id)
    if (index !== -1) {
      userBookings.value[index].status = 'cancelled'
    }
    
    // Close modal
    isConfirmModalOpen.value = false
    bookingToCancel.value = null
    
    // Reload user bookings
    await loadUserBookings()
  } catch (error) {
    console.error('Error cancelling booking:', error)
    toast.add({
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
  if (user.value) {
    await loadUserBookings()
  }
})

// Watch for user changes
watch(user, async (newVal) => {
  if (newVal) {
    await loadUserBookings()
  } else {
    userBookings.value = []
  }
})
</script> 