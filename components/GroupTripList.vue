<template>
  <div class="group-trip-list">
    <div v-if="loading" class="flex justify-center py-8">
      <UProgress animation="carousel" />
    </div>
    
    <div v-else>
      <div v-if="bookableTrips.length" class="space-y-4">
        <TransitionGroup name="list">
          <UCard
            v-for="trip in bookableTrips"
            :key="trip.id"
            class="border-l-4 border-green-500 transition-transform duration-300 hover:shadow-lg cursor-pointer"
            @click="selectTrip(trip)"
          >
            <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 p-4">
              <!-- Boat images -->
              <div class="w-full md:w-64 flex-shrink-0">
                <!-- Изображение лодки -->
                <img 
                  :src="getBoatImage(trip.boat)" 
                  :alt="trip.boat?.name || 'Лодка'"
                  class="w-full h-48 object-cover rounded-lg"
                />
                
                <!-- Рейтинг -->
                <div class="mt-2 flex items-center">
                  <div class="flex items-center">
                    <span class="flex items-center">
                      <UIcon name="i-heroicons-star" class="text-yellow-400 mr-1" />
                      <span class="font-medium">{{ getBoatRating(trip.boat_id) }}</span>
                    </span>
                    <span class="text-sm text-gray-500 ml-2">
                      ({{ getReviewCount(trip.boat_id) }} отзывов)
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="flex-1">
                <div class="flex items-start gap-3">
                  <UIcon name="i-heroicons-user-group" class="text-2xl text-blue-500 flex-shrink-0" />
                  <div>
                    <h3 class="font-medium">
                      Групповая поездка
                      <span v-if="trip.boat?.name" class="text-gray-600">
                        на лодке "{{ trip.boat.name }}"
                      </span>
                    </h3>
                    
                    <div class="mt-2 flex flex-wrap gap-2">
                      <UBadge color="primary" variant="subtle">
                        осталось {{ trip.available_seats }} мест
                      </UBadge>
                      <UBadge color="success" variant="subtle">
                        Взрослый: {{ formatPrice(trip.adult_price) }}
                      </UBadge>
                      <UBadge color="success" variant="subtle">
                        Ребенок: {{ formatPrice(trip.child_price) }}
                      </UBadge>
                      <UBadge color="warning" variant="subtle">
                        {{ getGroupStatusText(trip) }}
                      </UBadge>
                    </div>
                    
                    <p v-if="trip.description" class="mt-2 text-sm text-gray-600">
                      {{ truncateText(trip.description, 150) }}
                    </p>
                    
                    <div class="mt-4 flex items-center gap-2">
                      <!-- Управление для менеджеров -->
                      <div v-if="isManagerForBoat(trip.boat_id)" class="flex flex-wrap gap-2">
                        <UButton
                          color="orange"
                          variant="soft"
                          icon="i-heroicons-play"
                          size="sm"
                          @click.stop="startTrip(trip)"
                        >
                          Отправить
                        </UButton>
                        <!-- Inline редактирование мест -->
                        <div v-if="isManagerForBoat(trip.boat_id)" class="flex items-center gap-2">
                          <UButtonGroup size="sm">
                            <UButton
                              color="gray"
                              variant="soft"
                              icon="i-heroicons-minus"
                              @click.stop="adjustSeats(trip, -1)"
                              :disabled="editingSeats[trip.id] ? editingSeats[trip.id].current <= 0 : trip.available_seats <= 0"
                            />
                            <UInput
                              :model-value="editingSeats[trip.id] ? editingSeats[trip.id].current : trip.available_seats"
                              readonly
                              class="w-16 text-center"
                              :class="hasUnsavedChanges(trip) ? 'ring-2 ring-yellow-400' : ''"
                              size="sm"
                            />
                            <UButton
                              color="gray"
                              variant="soft"
                              icon="i-heroicons-plus"
                              @click.stop="adjustSeats(trip, 1)"
                              :disabled="editingSeats[trip.id] ? editingSeats[trip.id].current >= trip.total_seats : trip.available_seats >= trip.total_seats"
                            />
                          </UButtonGroup>
                          
                          <!-- Кнопки сохранения/отмены (показываются только при изменениях) -->
                          <div v-if="hasUnsavedChanges(trip)" class="flex gap-1">
                            <UButton
                              color="green"
                              variant="soft"
                              icon="i-heroicons-check"
                              size="xs"
                              @click.stop="saveSeats(trip)"
                              title="Сохранить изменения"
                            />
                            <UButton
                              color="red"
                              variant="soft"
                              icon="i-heroicons-x-mark"
                              size="xs"
                              @click.stop="cancelEditingSeats(trip.id)"
                              title="Отменить изменения"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center gap-2 self-end md:self-center">
                <!-- Кнопка бронирования для всех -->
                <UButton
                  color="primary"
                  icon="i-heroicons-ticket"
                  @click.stop="bookTrip(trip)"
                  :disabled="trip.available_seats === 0"
                >
                  {{ trip.available_seats > 0 ? 'Забронировать' : 'Нет мест' }}
                </UButton>
              </div>
            </div>
          </UCard>
        </TransitionGroup>
      </div>
      
      <div v-else class="text-center py-10">
        <UIcon name="i-heroicons-calendar" class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-lg font-medium text-gray-900">Нет доступных поездок</h3>
        <p class="mt-1 text-sm text-gray-500">
          В настоящее время нет запланированных групповых поездок
        </p>
      </div>
    </div>
    
    <!-- Booking Modal -->
    <UModal v-model="isBookingModalOpen">
      <GroupTripBookingForm
        v-if="selectedTrip"
        :trip="selectedTrip"
        @cancel="isBookingModalOpen = false"
        @success="onBookingSuccess"
      />
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSupabaseClient } from '#imports'
import { useGroupTripsStore } from '~/stores/groupTrips'
import { useBoatImages } from '~/composables/useBoatImages'
import { useAuth } from '~/composables/useAuth'
import { useManager } from '~/composables/useManager'

// Optional filter by boat
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

// Auth и права менеджера
const { user } = useAuth()

// Стейт
const loading = ref(true)
const isBookingModalOpen = ref(false)
const selectedTrip = ref(null)
const boatRatings = ref({})
const boatReviews = ref({})

// Стейт для редактирования мест
const editingSeats = ref({})

// Загрузка рейтингов из отзывов
const loadBoatReviews = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('boat_id, rating')
    
    if (error) throw error
    
    // Рассчитываем средний рейтинг и количество отзывов для каждой лодки
    const ratings = {}
    const reviewCounts = {}
    
    if (data) {
      data.forEach(review => {
        const boatId = review.boat_id
        
        if (!ratings[boatId]) {
          ratings[boatId] = 0
          reviewCounts[boatId] = 0
        }
        
        if (review.rating) {
          ratings[boatId] += review.rating
          reviewCounts[boatId]++
        }
      })
      
      // Рассчитываем средний рейтинг
      Object.keys(ratings).forEach(boatId => {
        if (reviewCounts[boatId] > 0) {
          ratings[boatId] = ratings[boatId] / reviewCounts[boatId]
        }
      })
    }
    
    boatRatings.value = ratings
    boatReviews.value = reviewCounts
  } catch (error) {
    console.error('Ошибка при загрузке рейтингов:', error)
  }
}

// Получить рейтинг для лодки
const getBoatRating = (boatId) => {
  const rating = boatRatings.value[boatId]
  return rating ? rating.toFixed(1) : '0.0'
}

// Получить количество отзывов для лодки
const getReviewCount = (boatId) => {
  return boatReviews.value[boatId] || 0
}

// Проверка прав менеджера для лодки
function isManagerForBoat(boatId) {
  if (!user.value) return false;
  if (user.value.role === 'admin') return true;
  
  // Проверка является ли пользователь менеджером лодки
  const { isManager } = useManager(
    computed(() => user.value?.id ?? null),
    computed(() => boatId ?? null)
  );
  
  return isManager.value;
}

// Use the shared state from the Pinia store
const bookableTrips = computed(() => {
  const trips = groupTripsStore.bookableTrips
  // Filter by boat ID if provided
  return props.boatId ? trips.filter(trip => trip.boat_id === props.boatId) : trips
})

// Load available trips using the Pinia store
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

// Helper methods
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

const formatPrice = (price) => {
  return `${price.toLocaleString('ru-RU')} ₽`
}

const truncateText = (text, maxLength) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Получение одного изображения лодки
function getBoatImage(boat) {
  if (boat && boat.slug) {
    const { primary } = useBoatImages(boat);
    if (primary.value) return primary.value;
  }
  return '/images/default-boat.jpg';
}

// Helper to get group status text based on available seats
const getGroupStatusText = (trip) => {
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

// Select trip for booking
const selectTrip = (trip) => {
  selectedTrip.value = trip
  groupTripsStore.setActiveTrip(trip) // Set active trip in the Pinia store
  isBookingModalOpen.value = true
  emit('tripSelected', trip)
}

// Alias for booking directly
const bookTrip = selectTrip

// Handle successful booking
const onBookingSuccess = (booking) => {
  isBookingModalOpen.value = false
  
  // Refresh trips after booking
  loadBookableTrips()
  
  emit('bookingSuccess', booking)
}

// Функции управления поездками для менеджеров
const startTrip = async (trip) => {
  try {
    const { error } = await groupTripsStore.startTrip(trip.id)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Лодка отправлена, поездка началась',
      color: 'success'
    })
    
    // Обновить список поездок
    await loadBookableTrips()
  } catch (error) {
    console.error('Error starting trip:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось начать поездку',
      color: 'error'
    })
  }
}

// Инициализация редактирования мест для поездки
const startEditingSeats = (trip) => {
  editingSeats.value[trip.id] = {
    original: trip.available_seats,
    current: trip.available_seats,
    isEditing: true
  }
}

// Изменение локального значения мест
const adjustSeats = (trip, delta) => {
  if (!editingSeats.value[trip.id]) {
    startEditingSeats(trip)
  }
  
  const newValue = editingSeats.value[trip.id].current + delta
  if (newValue >= 0 && newValue <= trip.total_seats) {
    editingSeats.value[trip.id].current = newValue
  }
}

// Отмена редактирования
const cancelEditingSeats = (tripId) => {
  delete editingSeats.value[tripId]
}

// Сохранение изменений мест
const saveSeats = async (trip) => {
  const editing = editingSeats.value[trip.id]
  if (!editing || editing.current === editing.original) {
    cancelEditingSeats(trip.id)
    return
  }
  
  try {
    const { error } = await groupTripsStore.updateTripSeats(trip.id, editing.current)
    
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: `Количество мест изменено на ${editing.current}`,
      color: 'success'
    })
    
    // Очищаем состояние редактирования
    cancelEditingSeats(trip.id)
    
    // Обновить список поездок
    await loadBookableTrips()
  } catch (error) {
    console.error('Error updating seats:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось обновить количество мест',
      color: 'error'
    })
  }
}

// Проверка есть ли несохраненные изменения
const hasUnsavedChanges = (trip) => {
  const editing = editingSeats.value[trip.id]
  return editing && editing.current !== editing.original
}

// Load trips on mount and ratings
onMounted(async () => {
  await Promise.all([
    loadBookableTrips(),
    loadBoatReviews()
  ])
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