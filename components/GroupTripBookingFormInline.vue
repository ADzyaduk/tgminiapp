<template>
  <div class="group-trip-booking-form-inline">
    <div class="rounded-lg p-6 space-y-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <UIcon name="i-heroicons-ticket" class="text-blue-600" />
          Бронирование поездки
        </h3>
        <UButton
          color="gray"
          variant="ghost"
          icon="i-heroicons-x-mark"
          size="sm"
          @click="$emit('cancel')"
        />
      </div>

      <!-- Краткая информация о поездке -->
      <div class="rounded-lg p-4 border border-blue-100">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-users" class="text-blue-500" />
            <span class="text-gray-600">Осталось мест:</span>
            <span class="font-medium text-blue-600">{{ trip.available_seats }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-banknotes" class="text-green-500" />
            <span class="text-gray-600">Взрослый:</span>
            <span class="font-medium text-green-600">{{ formatPrice(trip.adult_price) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-heart" class="text-pink-500" />
            <span class="text-gray-600">Ребенок:</span>
            <span class="font-medium text-pink-600">{{ formatPrice(trip.child_price) }}</span>
          </div>
        </div>
      </div>

      <!-- Форма бронирования -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Левая колонка -->
        <div class="space-y-4">
          <UFormField label="Имя гостя" name="guestName" :required="true">
            <UInput 
              v-model="form.guestName" 
              placeholder="Введите имя"
              icon="i-heroicons-user"
              :error="errors.guestName"
            />
          </UFormField>
          
          <UFormField label="Телефон гостя" name="guestPhone">
            <UInput 
              v-model="form.guestPhone" 
              placeholder="+7 (900) 123-45-67"
              icon="i-heroicons-phone"
              @input="handlePhoneInput"
            />
          </UFormField>

          <UFormField label="Примечания" name="notes">
            <UTextarea 
              v-model="form.notes" 
              placeholder="Дополнительная информация"
              :rows="3"
            />
          </UFormField>
        </div>

        <!-- Правая колонка -->
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Взрослые" name="adultCount" :required="true">
              <UInput
                v-model="form.adultCount"
                type="number"
                min="0"
                :max="trip.available_seats"
                icon="i-heroicons-user"
                :error="errors.adultCount"
              />
            </UFormField>
            
            <UFormField label="Дети" name="childCount">
              <UInput
                v-model="form.childCount"
                type="number"
                min="0"
                :max="trip.available_seats - form.adultCount"
                icon="i-heroicons-heart"
              />
            </UFormField>
          </div>

          <!-- Калькулятор стоимости -->
          <div class="rounded-lg p-4 border border-gray-200">
            <h4 class="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <UIcon name="i-heroicons-calculator" class="text-blue-500" />
              Расчет стоимости
            </h4>
            
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">{{ form.adultCount }} взрослых × {{ formatPrice(trip.adult_price) }}</span>
                <span class="font-medium">{{ formatPrice(form.adultCount * trip.adult_price) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">{{ form.childCount }} детей × {{ formatPrice(trip.child_price) }}</span>
                <span class="font-medium">{{ formatPrice(form.childCount * trip.child_price) }}</span>
              </div>
              <div class="border-t pt-2 flex justify-between">
                <span class="font-semibold text-gray-800">Итого:</span>
                <span class="font-bold text-lg text-blue-600">{{ formatPrice(form.totalPrice) }}</span>
              </div>
            </div>
          </div>

          <!-- Ошибки -->
          <div v-if="errorMessage" class="border border-red-200 rounded-lg p-3">
            <div class="flex items-center gap-2 text-red-700">
              <UIcon name="i-heroicons-exclamation-triangle" />
              <span class="text-sm">{{ errorMessage }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Кнопки действий -->
      <div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
        <UButton
          color="gray"
          variant="soft"
          @click="$emit('cancel')"
          class="flex-1 sm:flex-none"
        >
          Отмена
        </UButton>
        <UButton
          color="primary"
          :loading="isSaving"
          :disabled="isFormInvalid || trip.available_seats <= 0"
          @click="submitBooking"
          class="flex-1"
        >
          <template #leading>
            <UIcon name="i-heroicons-check" />
          </template>
          Забронировать {{ totalGuests > 0 ? `(${totalGuests} ${getGuestWord(totalGuests)})` : '' }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSupabaseClient } from '#imports'
import { useGroupTripsStore } from '~/stores/groupTrips'

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

const handlePhoneInput = (event: InputEvent) => {
  const input = event.target as HTMLInputElement;
  if (!input.value.startsWith('+7 ')) {
    input.value = '+7 ';
  }
  // Опционально: можно добавить маску для форматирования номера
}

// Состояние формы
const form = ref({
  guestName: '',
  guestPhone: '+7 ',
  adultCount: 1,
  childCount: 0,
  notes: '',
  totalPrice: 0
})

const isSaving = ref(false)
const errorMessage = ref('')
const errors = ref({})

// Вычисляемые свойства
const totalGuests = computed(() => {
  return parseInt(form.value.adultCount) + parseInt(form.value.childCount)
})

const isFormInvalid = computed(() => {
  return !form.value.guestName.trim() || 
    totalGuests.value === 0 ||
    totalGuests.value > props.trip.available_seats
})

// Валидация формы - объявляем ДО использования в watch
const validateForm = () => {
  errors.value = {}
  
  if (!form.value.guestName.trim()) {
    errors.value.guestName = 'Обязательное поле'
  }
  
  if (totalGuests.value === 0) {
    errors.value.adultCount = 'Укажите количество гостей'
  }
  
  if (totalGuests.value > props.trip.available_seats) {
    errors.value.adultCount = 'Превышено количество доступных мест'
  }
}

// Вычисление общей стоимости - объявляем ДО использования в watch
const calculateTotalPrice = () => {
  const adultTotal = parseInt(form.value.adultCount) * props.trip.adult_price
  const childTotal = parseInt(form.value.childCount) * props.trip.child_price
  form.value.totalPrice = adultTotal + childTotal
}

// Вспомогательные функции
const formatPrice = (price) => {
  return `${price.toLocaleString('ru-RU')} ₽`
}

const getGuestWord = (count) => {
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'гостей'
  }
  
  if (lastDigit === 1) return 'гость'
  if (lastDigit >= 2 && lastDigit <= 4) return 'гостя'
  return 'гостей'
}

// Отправка бронирования
const submitBooking = async () => {
  validateForm()
  
  if (isFormInvalid.value) {
    errorMessage.value = 'Пожалуйста, заполните все необходимые поля корректно'
    return
  }
  
  if (totalGuests.value > props.trip.available_seats) {
    errorMessage.value = 'Недостаточно свободных мест для бронирования'
    return
  }
  
  try {
    isSaving.value = true
    errorMessage.value = ''
    
    // Подготовка данных для бронирования
    const bookingData = {
      group_trip_id: props.trip.id,
      guest_name: form.value.guestName.trim(),
      guest_phone: form.value.guestPhone.trim(),
      adult_count: parseInt(form.value.adultCount),
      child_count: parseInt(form.value.childCount),
      total_price: form.value.totalPrice,
      notes: form.value.notes.trim(),
      status: 'confirmed'
    }
    
    // Отправка в Supabase
    const { data, error } = await supabaseClient
      .from('group_trip_bookings')
      .insert(bookingData)
      .select()
    
    if (error) throw error
    
    // Обновление доступных мест в Pinia store
    const newAvailableSeats = props.trip.available_seats - totalGuests.value
    await groupTripsStore.updateTripSeats(props.trip.id, newAvailableSeats)
    
    toast.add({
      title: 'Успешно!',
      description: `Бронирование создано для ${totalGuests.value} ${getGuestWord(totalGuests.value)}`,
      color: 'success',
      timeout: 5000
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

// Отслеживание изменений в количестве гостей - ПОСЛЕ объявления функций
watch(() => [form.value.adultCount, form.value.childCount], () => {
  calculateTotalPrice()
  validateForm()
}, { immediate: true })

// Инициализация при создании компонента
calculateTotalPrice()
</script>

<style scoped>
.group-trip-booking-form-inline {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style> 