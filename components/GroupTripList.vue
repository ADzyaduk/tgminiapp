<template>
  <div class="group-trip-list">
    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center py-8">
      <UProgress animation="carousel" />
    </div>
    
    <!-- Trip cards -->
    <div v-else>
      <div v-if="bookableTrips.length > 0" class="space-y-4">
        <TransitionGroup
          tag="div"
          name="trip-list"
          class="space-y-4"
        >
          <UCard
            v-for="trip in bookableTrips"
            :key="trip.id"
            class="hover:shadow-lg transition-shadow duration-200"
          >
            <div class="p-4">
              <div class="flex flex-col md:flex-row gap-4">
                <!-- Boat image -->
                <div class="w-full md:w-32 h-32 flex-shrink-0">
                  <img 
                    :src="getBoatImage(trip.boat)" 
                    :alt="trip.boat?.name || 'Лодка'"
                    class="w-full h-full object-cover rounded-lg"
                  />
                </div>

                <!-- Trip info -->
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
                      
                      <!-- Date and time info -->
                      <div class="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
                        <div class="flex items-center gap-1">
                          <UIcon name="i-heroicons-calendar-days" />
                          <span>{{ formatDate(trip.start_time) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Кнопка Забронировать / Открыть форму -->
                <div class="mt-4 md:mt-0 flex flex-col items-stretch md:items-end gap-2">
                  <UButton
                    v-if="trip.status === 'scheduled' && trip.available_seats > 0 && !isBoatManager(trip.boat_id)" 
                    icon="i-heroicons-ticket"
                    size="md"
                    class="w-full md:w-auto"
                    @click="toggleBookingForm(trip.id)"
                  >
                    Забронировать
                  </UButton>
                  <UButton
                    v-else-if="trip.status === 'scheduled' && trip.available_seats === 0 && !isBoatManager(trip.boat_id)"
                    icon="i-heroicons-no-symbol"
                    size="md"
                    class="w-full md:w-auto"
                    color="gray"
                    disabled
                  >
                    Мест нет
                  </UButton>

                  <!-- MANAGER CONTROLS START -->
                  <div 
                    v-if="isBoatManager(trip.boat_id)" 
                    class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 md:border-none md:pt-0 md:mt-0 flex flex-col md:flex-row items-stretch md:items-center gap-2 self-stretch md:self-end flex-wrap justify-end"
                  >
                    <template v-if="trip.status !== 'completed' && trip.status !== 'cancelled'">
                      <UButton
                        v-if="trip.status === 'scheduled'"
                        color="primary" 
                        variant="soft"
                        icon="i-heroicons-play"
                        @click="startTrip(trip)"
                        class="w-full sm:w-auto"
                        size="sm"
                      >
                        Отправить
                      </UButton>
                      <UButton
                        v-if="trip.status === 'in_progress'"
                        color="primary"  
                        variant="soft"
                        icon="i-heroicons-check"
                        @click="completeTrip(trip)" 
                        class="w-full sm:w-auto"
                        size="sm"
                        title="Завершить поездку" 
                      >
                        Завершить
                      </UButton>
                      <UButton
                        v-if="['scheduled', 'in_progress'].includes(trip.status)"
                        color="error" 
                        variant="soft"
                        icon="i-heroicons-x-mark"
                        @click="cancelTrip(trip)"
                        class="w-full sm:w-auto"
                        size="sm"
                      >
                        Отменить
                      </UButton>
                      
                      <!-- Inline редактирование мест -->
                      <div v-if="['scheduled'].includes(trip.status)" class="flex items-center gap-1 sm:gap-2 justify-end sm:justify-start flex-wrap">
                        <UButtonGroup size="xs">
                          <UButton
                            color="gray"
                            variant="soft"
                            icon="i-heroicons-minus"
                            @click="adjustSeats(trip, -1)"
                            :disabled="editingSeats[trip.id] ? editingSeats[trip.id].current <= 0 : trip.available_seats <= 0"
                          />
                          <UInput
                            :model-value="editingSeats[trip.id] ? editingSeats[trip.id].current : trip.available_seats"
                            readonly
                            class="w-12 text-center"
                            :class="hasUnsavedChanges(trip) ? 'ring-1 ring-yellow-400' : ''"
                            size="xs"
                          />
                          <UButton
                            color="gray"
                            variant="soft"
                            icon="i-heroicons-plus"
                            @click="adjustSeats(trip, 1)"
                            :disabled="editingSeats[trip.id] ? editingSeats[trip.id].current >= trip.total_seats : trip.available_seats >= trip.total_seats"
                          />
                        </UButtonGroup>
                        
                        <div v-if="hasUnsavedChanges(trip)" class="flex gap-1">
                          <UButton
                            color="primary" 
                            variant="soft"
                            icon="i-heroicons-check"
                            size="2xs" 
                            @click="saveSeats(trip)"
                            title="Сохранить изменения мест"
                          />
                          <UButton
                            color="error" 
                            variant="soft"
                            icon="i-heroicons-x-mark"
                            size="2xs" 
                            @click="cancelEditingSeats(trip.id)"
                            title="Отменить изменения мест"
                          />
                        </div>
                      </div>
                    </template>
                  </div>
                  <!-- MANAGER CONTROLS END -->
                </div>
              </div>
              
              <!-- Встроенная форма бронирования -->
              <div v-if="expandedBookingForms[trip.id]" class="border-t border-gray-100 pt-4 mt-4">
                <GroupTripBookingFormInline
                  :trip="trip"
                  @cancel="hideBookingForm(trip.id)"
                  @success="onBookingSuccess"
                />
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

// Auth
const { user, isAdmin } = useAuth()

// Состояние
const loading = ref(true)
const boatRatings = ref({})
const boatReviews = ref({})
const editingSeats = ref({})
const expandedBookingForms = ref({})

// Computed свойства
const bookableTrips = computed(() => {
  const trips = groupTripsStore.bookableTrips
  return props.boatId ? trips.filter(trip => trip.boat_id === props.boatId) : trips
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
const toggleBookingForm = (tripId) => {
  expandedBookingForms.value[tripId] = !expandedBookingForms.value[tripId]
}

const hideBookingForm = (tripId) => {
  expandedBookingForms.value[tripId] = false
}

const onBookingSuccess = (booking) => {
  // Скрыть все формы бронирования
  Object.keys(expandedBookingForms.value).forEach(tripId => {
    expandedBookingForms.value[tripId] = false
  })
  
  // Обновить список поездок
  loadBookableTrips()
  
  emit('bookingSuccess', booking)
}

// Вспомогательные функции
const formatDate = (dateString) => {
  try {
    return format(parseISO(dateString), 'dd MMMM yyyy', { locale: ru })
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

const getBoatImage = (boat) => {
  if (boat && boat.slug) {
    const { primary } = useBoatImages(boat);
    if (primary.value) return primary.value;
  }
  return '/images/default-boat.jpg';
}

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

// Инициализация при монтировании
onMounted(() => {
  loadBookableTrips()
})

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
  
  const newValue = editingSeats.value[trip.id].current + delta;
  // Убедимся, что newValue не становится отрицательным или больше total_seats
  if (newValue >= 0 && newValue <= trip.total_seats) { 
    editingSeats.value[trip.id].current = newValue;
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
    // Убедимся, что editing.current это число
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
    await loadBookableTrips() // Обновить список поездок
  } catch (error) {
    console.error('Error updating seats:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось обновить количество мест' + (error instanceof Error ? `: ${error.message}` : ''),
      color: 'error'
    })
  }
}

// Проверка есть ли несохраненные изменения
const hasUnsavedChanges = (trip) => {
  const editing = editingSeats.value[trip.id]
  return editing && editing.current !== editing.original
}

// Проверка, является ли пользователь менеджером данной лодки
const isBoatManager = (boatId: string) => {
  if (!user.value) return false
  if (isAdmin.value) return true // Администратор может управлять всем
  // Используем composable useManager
  const { isManager: checkIsManager } = useManager(
    computed(() => user.value?.id ?? null),
    computed(() => boatId ?? null) 
  );
  return checkIsManager.value
}

// Функции управления поездкой (start, cancel)
const startTrip = async (trip) => {
  try {
    const { error } = await groupTripsStore.startTrip(trip.id)
    if (error) throw error
    toast.add({ title: 'Успешно', description: 'Поездка начата', color: 'success' })
    await loadBookableTrips() 
  } catch (err) {
    toast.add({ title: 'Ошибка', description: 'Не удалось начать поездку', color: 'error' })
  }
}

const cancelTrip = async (trip) => {
  if (!confirm('Вы уверены, что хотите отменить эту поездку?')) return
  try {
    const { error } = await groupTripsStore.cancelTrip(trip.id)
    if (error) throw error
    toast.add({ title: 'Успешно', description: 'Поездка отменена', color: 'success' })
    await loadBookableTrips()
  } catch (err) {
    toast.add({ title: 'Ошибка', description: 'Не удалось отменить поездку', color: 'error' })
  }
}
</script>

<style scoped>
.trip-list-enter-active,
.trip-list-leave-active {
  transition: all 0.3s ease;
}

.trip-list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.trip-list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style> 