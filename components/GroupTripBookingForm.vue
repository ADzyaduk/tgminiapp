<template>
  <div class="group-trip-booking-form">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium">Бронирование групповой поездки</h3>
        </div>
      </template>
      
      <div class="p-4 space-y-4">
        <!-- Information about the group trip -->
        <div class="p-4 rounded-lg mb-4">
          <div class="flex items-center gap-4">
            <!-- Boat image -->
            <div class="w-20 h-20 flex-shrink-0">
              <img 
                :src="getBoatImage(trip.boat)" 
                :alt="trip.boat?.name || 'Лодка'"
                class="w-full h-full object-cover rounded-md"
              />
            </div>
            
            <div>
              <h4 class="font-medium text-lg mb-1">
                Групповая поездка
                <span v-if="trip.boat?.name" class="text-gray-600 text-sm">
                  на лодке "{{ trip.boat.name }}"
                </span>
              </h4>
              
              <UBadge color="success" variant="subtle">
                осталось {{ trip.available_seats }} мест
              </UBadge>
            </div>
          </div>
          
          <div class="mt-3 grid grid-cols-2 gap-3">
            <div>
              <span class="text-sm text-gray-500">Цена за взрослого:</span>
              <div class="font-medium">{{ formatPrice(trip.adult_price) }}</div>
            </div>
            <div>
              <span class="text-sm text-gray-500">Цена за ребенка:</span>
              <div class="font-medium">{{ formatPrice(trip.child_price) }}</div>
            </div>
          </div>
          
          <div v-if="trip.description" class="mt-3 text-sm">
            {{ trip.description }}
          </div>
        </div>
        
        <!-- Booking form -->
        <div class="space-y-4">
          <UFormField label="Имя гостя" required>
            <UInput v-model="form.guestName" placeholder="Введите имя" />
          </UFormField>
          
          <UFormField label="Телефон гостя">
            <UInput v-model="form.guestPhone" placeholder="+7 (___) ___-__-__" />
          </UFormField>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Количество взрослых" required>
              <UInput
                v-model="form.adultCount"
                type="number"
                min="0"
                :max="trip.available_seats"
                @change="calculateTotalPrice"
              />
            </UFormField>
            
            <UFormField label="Количество детей" required>
              <UInput
                v-model="form.childCount"
                type="number"
                min="0"
                :max="trip.available_seats - form.adultCount"
                @change="calculateTotalPrice"
              />
            </UFormField>
          </div>
          
          <UFormField label="Примечания">
            <UTextarea v-model="form.notes" placeholder="Дополнительная информация" />
          </UFormField>
          
          <div class="p-4 rounded-lg">
            <div class="flex justify-between items-center">
              <span class="font-medium">Итого:</span>
              <span class="text-lg font-bold">{{ formatPrice(form.totalPrice) }}</span>
            </div>
            <div class="text-sm text-gray-500 mt-1">
              {{ form.adultCount }} взр. × {{ formatPrice(trip.adult_price) }} + {{ form.childCount }} дет. × {{ formatPrice(trip.child_price) }}
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="flex justify-between">
          <p v-if="errorMessage" class="text-red-500 text-sm">{{ errorMessage }}</p>
          <div class="flex gap-2 ml-auto">
            <UButton
              color="gray"
              variant="soft"
              @click="$emit('cancel')"
            >
              Отмена
            </UButton>
            <UButton
              color="primary"
              :loading="isSaving"
              :disabled="isFormInvalid || trip.available_seats <= 0"
              @click="submitBooking"
            >
              Забронировать
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useSupabaseClient } from '#imports'
import { useGroupTripsStore } from '~/stores/groupTrips'
import { useBoatImages } from '~/composables/useBoatImages'

const props = defineProps({
  trip: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['cancel', 'success'])

const supabaseClient = useSupabaseClient()
const toast = useToast()
const groupTripsStore = useGroupTripsStore()

// Form state
const form = ref({
  guestName: '',
  guestPhone: '',
  adultCount: 1,
  childCount: 0,
  notes: '',
  totalPrice: 0
})

const isSaving = ref(false)
const errorMessage = ref('')

// Calculate total price
const calculateTotalPrice = () => {
  const adultTotal = form.value.adultCount * props.trip.adult_price
  const childTotal = form.value.childCount * props.trip.child_price
  form.value.totalPrice = adultTotal + childTotal
}

// Computed property for form validation
const isFormInvalid = computed(() => {
  return !form.value.guestName || 
    (form.value.adultCount === 0 && form.value.childCount === 0) ||
    (form.value.adultCount + form.value.childCount) > props.trip.available_seats
})

// Watch for changes in adult and child count
watch(() => [form.value.adultCount, form.value.childCount], () => {
  calculateTotalPrice()
})

// Format helpers
const formatPrice = (price) => {
  return `${price.toLocaleString('ru-RU')} ₽`
}

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

// Submit booking
const submitBooking = async () => {
  if (isFormInvalid.value) {
    errorMessage.value = 'Пожалуйста, заполните все необходимые поля'
    return
  }
  
  // Check if there are enough seats available
  if ((form.value.adultCount + form.value.childCount) > props.trip.available_seats) {
    errorMessage.value = 'Недостаточно свободных мест для бронирования'
    return
  }
  
  try {
    isSaving.value = true
    errorMessage.value = ''
    
    // Prepare booking data
    const bookingData = {
      group_trip_id: props.trip.id,
      guest_name: form.value.guestName,
      guest_phone: form.value.guestPhone,
      adult_count: parseInt(form.value.adultCount),
      child_count: parseInt(form.value.childCount),
      total_price: form.value.totalPrice,
      notes: form.value.notes,
      status: 'confirmed'
    }
    
    // Submit to Supabase
    const { data, error } = await supabaseClient
      .from('group_trip_bookings')
      .insert(bookingData)
      .select()
    
    if (error) throw error
    
    // Update available seats in the Pinia store
    const newAvailableSeats = props.trip.available_seats - (form.value.adultCount + form.value.childCount)
    await groupTripsStore.updateTripSeats(props.trip.id, newAvailableSeats)
    
    toast.add({
      title: 'Успешно',
      description: 'Бронирование создано',
      color: 'success'
    })
    
    emit('success', data?.[0])
  } catch (error) {
    console.error('Error creating booking:', error)
    errorMessage.value = 'Не удалось создать бронирование. Попробуйте еще раз.'
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось создать бронирование',
      color: 'error'
    })
  } finally {
    isSaving.value = false
  }
}

// Initialize form
onMounted(() => {
  calculateTotalPrice()
})
</script> 