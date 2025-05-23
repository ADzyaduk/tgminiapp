<template>
  <div class="group-trip-manager">
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Групповые поездки</h2>
          <div class="flex items-center gap-2">
            <UInput
              v-model="newTripSeats"
              type="number"
              min="1"
              max="11"
              placeholder="Места"
              class="w-24"
            />
            <UButton
              icon="i-heroicons-plus"
              color="primary"
              @click="createTrip"
            >
              Создать поездку
            </UButton>
          </div>
        </div>
      </template>
      
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-8">
        <UProgress animation="carousel" />
      </div>
      
      <!-- Main content -->
      <div v-else>
        <!-- Filters -->
        <div class="mb-4 flex flex-wrap gap-2">
          <UButton 
            :color="statusFilter === 'current' ? 'primary' : 'gray'" 
            variant="soft" 
            size="sm"
            @click="statusFilter = 'current'"
          >
            Текущие
          </UButton>
          <UButton 
            :color="statusFilter === 'completed' ? 'primary' : 'gray'" 
            variant="soft" 
            size="sm"
            @click="statusFilter = 'completed'"
          >
            Завершенные
          </UButton>
        </div>
        
        <div v-if="filteredTrips.length" class="space-y-3">
          <TransitionGroup name="list">
            <UCard
              v-for="trip in filteredTrips"
              :key="trip.id"
              class="border-l-4"
              :class="{
                'border-green-500': trip.status === 'scheduled',
                'border-blue-500': trip.status === 'in_progress',
                'border-gray-500': trip.status === 'completed'
              }"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                <!-- Boat image -->
                <div class="w-16 h-16 flex-shrink-0">
                  <img 
                    :src="getBoatImage(trip.boat)" 
                    :alt="trip.boat?.name || 'Лодка'"
                    class="w-full h-full object-cover rounded-md"
                  />
                </div>
                
                <div class="flex-1">
                  <div class="flex items-start gap-3">
                    <UIcon name="i-heroicons-user-group" class="text-2xl text-blue-500" />
                    <div>
                      <h3 class="font-medium">
                        Групповая поездка
                        <span v-if="trip.boat?.name" class="text-gray-600 text-sm">
                          на лодке "{{ trip.boat.name }}"
                        </span>
                      </h3>
                      <p class="text-sm text-gray-500">{{ formatDate(trip.start_time) }} - {{ formatTime(trip.end_time) }}</p>
                      <p class="text-sm">
                        <UBadge color="primary" variant="subtle" class="mr-2">
                          {{ trip.available_seats }} / {{ trip.total_seats }} мест
                        </UBadge>
                        <UBadge
                          :color="getStatusColor(trip.status)"
                          variant="subtle"
                        >
                          {{ getStatusText(trip.status) }}
                        </UBadge>
                      </p>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 self-end md:self-center">
                  <!-- Show action buttons only for active trips -->
                  <template v-if="trip.status !== 'completed' && trip.status !== 'cancelled'">
                    <UButton
                      v-if="trip.status === 'scheduled'"
                      color="orange"
                      variant="soft"
                      icon="i-heroicons-play"
                      @click="startTrip(trip)"
                    >
                      Отправить
                    </UButton>
                    <UButton
                      v-if="trip.status === 'in_progress'"
                      color="green"
                      variant="soft"
                      icon="i-heroicons-check"
                      @click="completeTrip(trip)"
                    >
                      Завершить
                    </UButton>
                    <UButton
                      v-if="['scheduled', 'in_progress'].includes(trip.status)"
                      color="red"
                      variant="soft"
                      icon="i-heroicons-x-mark"
                      @click="cancelTrip(trip)"
                    >
                      Отменить
                    </UButton>
                    <UButton
                      v-if="['scheduled'].includes(trip.status)"
                      color="blue"
                      variant="soft"
                      icon="i-heroicons-pencil"
                      @click="updateSeats(trip)"
                    >
                      Места
                    </UButton>
                  </template>
                </div>
              </div>
            </UCard>
          </TransitionGroup>
        </div>
        
        <div v-else class="text-center py-10">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-lg font-medium text-gray-900">Нет групповых поездок</h3>
          <p class="mt-1 text-sm text-gray-500">
            Для этой лодки еще не созданы групповые поездки
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useSupabaseClient } from '#imports'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useGroupTripsStore } from '~/stores/groupTrips'
import { useBoatImages } from '~/composables/useBoatImages'

const props = defineProps({
  boatId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update'])

const supabaseClient = useSupabaseClient()
const toast = useToast()
const groupTripsStore = useGroupTripsStore()

// State
const loading = ref(true)
const statusFilter = ref('current')
const newTripSeats = ref(11) // Default value of 11 seats as requested

// Use the shared state from the Pinia store
const filteredTrips = computed(() => {
  if (statusFilter.value === 'current') {
    return groupTripsStore.currentTrips.filter(trip => trip.boat_id === props.boatId)
  } else if (statusFilter.value === 'completed') {
    return groupTripsStore.completedTrips.filter(trip => trip.boat_id === props.boatId)
  }
  return groupTripsStore.getTripsForBoat(props.boatId)
})

// Load group trips for the boat using the Pinia store
const loadGroupTrips = async () => {
  try {
    loading.value = true
    await groupTripsStore.loadGroupTripsForBoat(props.boatId)
  } catch (error) {
    console.error('Error loading group trips:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список групповых поездок',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Helper methods for formatting
const formatDate = (dateString) => {
  try {
    return format(parseISO(dateString), 'dd MMMM yyyy', { locale: ru })
  } catch (e) {
    return dateString
  }
}

const formatTime = (dateString) => {
  try {
    return format(parseISO(dateString), 'HH:mm', { locale: ru })
  } catch (e) {
    return dateString
  }
}

// Получение изображения лодки
function getBoatImage(boat) {
  if (boat && boat.slug) {
    const { primary } = useBoatImages(boat);
    if (primary.value) return primary.value;
  }
  return '/images/default-boat.jpg';
}

const getStatusText = (status) => {
  const statusMap = {
    'scheduled': 'Собирается группа',
    'in_progress': 'В пути',
    'completed': 'Завершена',
    'cancelled': 'Отменена'
  }
  return statusMap[status] || status
}

const getStatusColor = (status) => {
  const colorMap = {
    'scheduled': 'green',
    'in_progress': 'blue',
    'completed': 'gray',
    'cancelled': 'red'
  }
  return colorMap[status] || 'gray'
}

// Create trip with the input field using the Pinia store
const createTrip = async () => {
  const availableSeats = parseInt(newTripSeats.value)
  if (isNaN(availableSeats) || availableSeats <= 0) {
    toast.add({
      title: 'Ошибка',
      description: 'Количество мест должно быть положительным числом',
      color: 'error'
    })
    return
  }
  
  try {
    // Create trip with default values
    const tripData = {
      boat_id: props.boatId,
      name: 'Групповая поездка',
      description: 'Стандартная групповая поездка на 45 минут',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 45 * 60000).toISOString(),
      // Remove duration field since it's not in the schema
      adult_price: 2000,
      child_price: 1000,
      total_seats: availableSeats,
      available_seats: availableSeats,
      status: 'scheduled'
    }
    
    const { error } = await groupTripsStore.createGroupTrip(tripData)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Групповая поездка создана',
      color: 'success'
    })
    
    emit('update')
  } catch (error) {
    console.error('Error saving group trip:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось создать групповую поездку',
      color: 'error'
    })
  }
}

// Use Pinia store methods for trip management
const startTrip = async (trip) => {
  try {
    const { error } = await groupTripsStore.startTrip(trip.id)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Лодка отправлена, поездка началась',
      color: 'success'
    })
  } catch (error) {
    console.error('Error starting trip:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось начать поездку',
      color: 'error'
    })
  }
}

const completeTrip = async (trip) => {
  try {
    const { error } = await groupTripsStore.completeTrip(trip.id)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Поездка завершена',
      color: 'success'
    })
  } catch (error) {
    console.error('Error completing trip:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось завершить поездку',
      color: 'error'
    })
  }
}

const cancelTrip = async (trip) => {
  // Use confirm instead of modal
  if (!confirm(`Вы уверены, что хотите отменить групповую поездку?`)) return
  
  try {
    const { error } = await groupTripsStore.cancelTrip(trip.id)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Поездка отменена',
      color: 'success'
    })
  } catch (error) {
    console.error('Error cancelling trip:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось отменить поездку',
      color: 'error'
    })
  }
}

// Update seats using prompt and Pinia store method
const updateSeats = async (trip) => {
  const newSeats = prompt(`Введите количество свободных мест (максимум ${trip.total_seats}):`, trip.available_seats)
  if (newSeats === null) return // User cancelled
  
  const seatsValue = parseInt(newSeats)
  if (isNaN(seatsValue)) {
    toast.add({
      title: 'Ошибка',
      description: 'Введите корректное число',
      color: 'error'
    })
    return
  }
  
  if (seatsValue < 0 || seatsValue > trip.total_seats) {
    toast.add({
      title: 'Ошибка',
      description: `Количество мест должно быть от 0 до ${trip.total_seats}`,
      color: 'error'
    })
    return
  }
  
  // Skip if unchanged
  if (seatsValue === trip.available_seats) return
  
  try {
    const { error } = await groupTripsStore.updateTripSeats(trip.id, seatsValue)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Количество мест обновлено',
      color: 'success'
    })
  } catch (error) {
    console.error('Error updating seats:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось обновить количество мест',
      color: 'error'
    })
  }
}

// Загрузка данных при монтировании
onMounted(async () => {
  await loadGroupTrips()
  // Subscription is handled by the plugin
})

// Следим за изменением ID лодки
watch(() => props.boatId, async (newVal, oldVal) => {
  if (newVal !== oldVal) {
    await loadGroupTrips()
  }
})
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style> 