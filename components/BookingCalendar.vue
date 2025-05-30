<template>
  <section class="space-y-8 max-w-2xl mx-auto">
    <!-- Выбор даты -->
    <div class="rounded-lg shadow-sm p-4">
      <h3 class="text-xl font-semibold mb-4">Забронировать лодку</h3>
      <UCalendar class="max-w-64 mx-auto" v-model="selectedDate" :min-date="calendarMinDate" />
    </div>

    <!-- Слоты времени -->
    <div class="rounded-lg shadow-sm p-4">
      <h3 class="text-xl font-semibold mb-4">
        Доступное время на {{ formattedDate }}
      </h3>

      <div v-if="!isManualTime">
        <!-- Выбор по слотам -->
        <div class="flex flex-wrap gap-3 mb-6">
          <UButton v-for="hour in allSlots" :key="hour" :disabled="isBooked(hour) || isPastHour(hour)"
            :variant="variantFor(hour)" :class="[
              'min-w-[80px] transition-all duration-200',
              (isBooked(hour) || isPastHour(hour)) && '!bg-gradient-to-r !from-red-900 !to-red-800 !text-red-100 !border-red-800 hover:!from-red-900 hover:!to-red-800'
            ]" @click="selectSlot(hour)">
            {{ hour }}:00
          </UButton>
        </div>

        <UButton @click="isManualTime = !isManualTime" class="w-full mb-6">
          Ввести время вручную
        </UButton>
      </div>

      <!-- Ручной ввод времени -->
      <div v-else class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <UFormField label="Время начала">
            <UInput v-model="manualStartTime" type="time" :min="minTimeInput" class="w-full" />
          </UFormField>
          <UFormField label="Время окончания">
            <UInput v-model="manualEndTime" type="time" :min="manualStartTime || minTimeInput" class="w-full" />
          </UFormField>
        </div>

        <div class="flex gap-4 mb-6">
          <UButton @click="setManualTime" :disabled="!canSetManualTime" class="w-full">
            Выбрать эти часы
          </UButton>

          <UButton @click="isManualTime = false" variant="outline" class="w-full">
            Вернуться к слотам
          </UButton>
        </div>
      </div>

      <!-- Форма ввода -->
      <div v-if="selectedSlot !== null || isManualTimeSelected" class="space-y-4 mt-6 border-t pt-4">
        <UFormField v-if="!isManualTimeSelected" label="Длительность (часов)">
          <UInput type="number" v-model.number="duration" min="1" class="w-full" />
        </UFormField>

        <UFormField label="Имя">
          <UInput v-model.trim="guestName" class="w-full" placeholder="Имя гостя" />
        </UFormField>

        <!-- Поле телефона для неавторизованных пользователей и пользователей с ролью 'user' -->
        <UFormField v-if="needsPhoneField" label="Телефон" required>
          <UInput v-model.trim="guestPhone" class="w-full" placeholder="+7 (___) ___-__-__" />
        </UFormField>

        <UFormField label="Количество человек">
          <UInput type="number" v-model.number="peopleCount" min="1" class="w-full" />
        </UFormField>

        <!-- Дополнительные поля для админа/агента/менеджера -->
        <template v-if="isAdminOrAgentOrManager">
          <UFormField label="Цена за час">
            <UInput type="number" v-model.number="pph" min="0" class="w-full" placeholder="Цена за час" />
          </UFormField>

          <UFormField label="Предоплата">
            <UInput type="number" v-model.number="prepayment" min="0" class="w-full" placeholder="Сумма предоплаты" />
          </UFormField>

          <UFormField label="Комментарий">
            <UTextarea v-model.trim="guestNote" class="w-full" placeholder="Комментарий к бронированию" />
          </UFormField>
        </template>

        <div class="border-t pt-4">
          <UButton class="w-full py-3" :disabled="!canBook" @click="bookSlot">
            Забронировать
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { CalendarDate } from '@internationalized/date'
import { useSupabaseClient } from '#imports'
import type { Database } from '~/types/supabase'
import { useDateStore } from '~/stores/useDateStore'

// Константы рабочего дня
const WORK_START = 8
const WORK_END = 22

// Props & Emits
const props = defineProps<{
  boatId: string
  boat: any
  user?: any
}>()
const emit = defineEmits<{
  (e: 'bookingCreated'): void
}>()

// Supabase клиент
const supabaseClient = useSupabaseClient<Database>()

// Инициализируем текущую дату для ограничения минимальной даты
const today = new Date()
const currentDate = new CalendarDate(
  today.getFullYear(),
  today.getMonth() + 1,
  today.getDate()
)

// Используем Pinia store для даты
const dateStore = useDateStore()
// Двусторонняя привязка с v-model
const selectedDate = computed({
  get: () => dateStore.selectedDate,
  set: (value: CalendarDate) => dateStore.setDate(value)
})

// Инициализируем toast
const { $toast: toast } = useNuxtApp()

// --- STATE ---
const selectedSlot = ref<number | null>(null)
const duration = ref(1)
const guestName = ref('')
const guestPhone = ref('')
const peopleCount = ref(1)
const bookedSlots = ref<number[]>([])
const pph = ref(0)
const prepayment = ref(0)
const guestNote = ref('')

// Состояние для ручного ввода времени
const isManualTime = ref(false)
const manualStartTime = ref('')
const manualEndTime = ref('')
const isManualTimeSelected = ref(false)

// --- COMPUTED ---
const calendarMinDate = computed(() => currentDate)

const allSlots = computed(() =>
  Array.from({ length: WORK_END - WORK_START }, (_, i) => WORK_START + i)
)

const formattedDate = computed(() => {
  try {
    if (!selectedDate.value) {
      return 'Выберите дату' // Default text if no date is selected
    }
    return selectedDate.value.toDate('UTC').toISOString().slice(0, 10)
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Неверная дата'
  }
})

// Определение роли пользователя
const getUserRole = computed(() => {
  if (!props.user) return null
  return props.user.role || props.user.user_metadata?.role
})

const isAdmin = computed(() => getUserRole.value === 'admin')
const isAgent = computed(() => getUserRole.value === 'agent')
const isManager = computed(() => getUserRole.value === 'manager')
const isAdminOrAgentOrManager = computed(() => isAdmin.value || isAgent.value || isManager.value)

// Нужно ли поле телефона (для неавторизованных или пользователей с ролью 'user')
const needsPhoneField = computed(() => {
  if (!props.user) return true // Неавторизованный пользователь
  const role = getUserRole.value
  return !role || role === 'user' // Пользователь без роли или с ролью 'user'
})

// Цена на основе роли пользователя
const displayedPrice = computed(() => {
  // Для админов и агентов показываем agent_price, для остальных - обычную цену
  return (isAdmin.value || isAgent.value) ? props.boat.agent_price : props.boat.price
})

// Вычисление общей стоимости
const totalPrice = computed(() => {
  if (isManualTimeSelected.value) {
    const hours = calculateHourDifference(manualStartTime.value, manualEndTime.value)
    return displayedPrice.value * hours
  }
  return displayedPrice.value * duration.value
})

// Минимальное время для ручного ввода
const minTimeInput = computed(() => {
  // Если сегодня, ограничиваем текущим временем
  const selectedDateObj = selectedDate.value.toDate('UTC')
  const now = new Date()

  const isToday = selectedDateObj.getDate() === now.getDate() &&
    selectedDateObj.getMonth() === now.getMonth() &&
    selectedDateObj.getFullYear() === now.getFullYear()

  if (!isToday) return `${WORK_START}:00`

  const hours = now.getHours()
  const minutes = now.getMinutes()

  // Если время уже после рабочего дня, возвращаем время начала рабочего дня
  if (hours >= WORK_END) return `${WORK_START}:00`

  // Если время до начала рабочего дня, возвращаем время начала рабочего дня
  if (hours < WORK_START) return `${WORK_START}:00`

  // Форматируем текущее время с ведущими нулями
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
})

// Проверка возможности сохранить ручное время
const canSetManualTime = computed(() => {
  if (!manualStartTime.value || !manualEndTime.value) return false

  // Проверяем, что начальное время раньше конечного
  return manualStartTime.value < manualEndTime.value
})

// Проверка на конфликт времени с существующими бронированиями
const isTimeConflict = computed(() => {
  if (selectedSlot.value === null && !isManualTimeSelected.value) return false

  if (isManualTimeSelected.value) {
    // Проверка для ручного времени
    const startHour = parseInt(manualStartTime.value.split(':')[0])
    const endHour = parseInt(manualEndTime.value.split(':')[0])

    for (let h = startHour; h < endHour; h++) {
      if (bookedSlots.value.includes(h)) return true
    }
    return false
  } else {
    // Проверка для слотов
    for (let h = selectedSlot.value!; h < selectedSlot.value! + duration.value; h++) {
      if (bookedSlots.value.includes(h)) return true
    }
    return false
  }
})

const canBook = computed(() =>
  (selectedSlot.value !== null || isManualTimeSelected.value) &&
  (isManualTimeSelected.value || duration.value >= 1) &&
  guestName.value.trim() !== '' &&
  (!needsPhoneField.value || guestPhone.value.trim() !== '') &&
  peopleCount.value > 0 &&
  !isTimeConflict.value
)

// --- HELPERS ---
// Вычисляет разницу между двумя временами в часах
function calculateHourDifference(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0

  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)

  const startTotalMinutes = startHour * 60 + startMinute
  const endTotalMinutes = endHour * 60 + endMinute

  // Переводим минуты в часы, округляя вверх
  return Math.ceil((endTotalMinutes - startTotalMinutes) / 60)
}

const variantFor = (hour: number) => {
  if (isBooked(hour)) return 'outline'
  if (isPastHour(hour)) return 'outline'
  if (selectedSlot.value === hour) return 'solid'
  return 'outline'
}

function isBooked(hour: number) {
  return bookedSlots.value.includes(hour)
}

function isPastHour(hour: number) {
  try {
    // Получаем текущее время
    const now = new Date()
    const currentHour = now.getHours()

    // Если нет выбранной даты, считаем что час не прошел
    if (!selectedDate.value) {
      return false
    }

    // Получаем дату из CalendarDate
    let selectedDateObj: Date
    try {
      selectedDateObj = selectedDate.value.toDate('UTC')
    } catch (e) {
      console.error('Error converting selectedDate to Date:', e)
      return false
    }

    // Проверяем, выбран ли текущий день
    const isToday =
      selectedDateObj.getDate() === now.getDate() &&
      selectedDateObj.getMonth() === now.getMonth() &&
      selectedDateObj.getFullYear() === now.getFullYear()

    // Если сегодня, проверяем, не прошел ли час
    return isToday && hour <= currentHour
  } catch (error) {
    console.error('Error in isPastHour:', error)
    return false // Если произошла ошибка, считаем час доступным
  }
}

function selectSlot(hour: number) {
  // Не даем выбрать прошедший час
  if (isPastHour(hour)) return

  selectedSlot.value = hour
  isManualTimeSelected.value = false // Сбрасываем ручной выбор времени

  // Инициализируем цену за час для админа/агента/менеджера
  if (isAdminOrAgentOrManager.value) {
    pph.value = displayedPrice.value
  }
}

// Устанавливает время, выбранное вручную
function setManualTime() {
  if (!canSetManualTime.value) return

  isManualTimeSelected.value = true
  selectedSlot.value = null // Сбрасываем выбор слота

  // Инициализируем цену за час для админа/агента/менеджера
  if (isAdminOrAgentOrManager.value) {
    pph.value = displayedPrice.value
  }
}

// --- DATA FETCHING ---
async function fetchBookings() {
  try {
    if (!selectedDate.value) {
      console.warn('fetchBookings called without a valid selectedDate')
      return
    }

    const js = selectedDate.value.toDate('UTC')
    const start = new Date(js); start.setHours(WORK_START, 0, 0, 0)
    const end = new Date(js); end.setHours(WORK_END, 0, 0, 0)

    const { data } = await supabaseClient
      .from('bookings')
      .select('start_time, end_time')
      .eq('boat_id', props.boatId)
      .eq('status', 'confirmed')
      .gte('start_time', start.toISOString())
      .lte('end_time', end.toISOString())

    if (data) {
      const hours = data.flatMap(b => {
        // Используем безопасное приведение типов
        const startTime = b.start_time as string
        const endTime = b.end_time as string
        const s = new Date(startTime).getHours()
        const e = new Date(endTime).getHours()
        return Array.from({ length: e - s }, (_, i) => s + i)
      })
      bookedSlots.value = [...new Set(hours)]
    }
  } catch (error) {
    console.error('Error in fetchBookings:', error)
    bookedSlots.value = [] // Reset to empty if there's an error
  }
}

// --- BOOKING ---
async function bookSlot() {
  if (!canBook.value) return
  if (!selectedDate.value) {
    toast.error('Пожалуйста, выберите дату')
    return
  }

  try {
    let startIso: Date, endIso: Date

    if (isManualTimeSelected.value) {
      // Для ручного выбора времени
      const selectedDateObj = selectedDate.value.toDate('UTC')
      const [startHour, startMinute] = manualStartTime.value.split(':').map(Number)
      const [endHour, endMinute] = manualEndTime.value.split(':').map(Number)

      startIso = new Date(selectedDateObj)
      startIso.setHours(startHour, startMinute, 0, 0)

      endIso = new Date(selectedDateObj)
      endIso.setHours(endHour, endMinute, 0, 0)
    } else {
      // Для выбора по слотам
      startIso = new Date(selectedDate.value.toDate('UTC'))
      startIso.setHours(selectedSlot.value!, 0, 0, 0)

      endIso = new Date(startIso)
      endIso.setHours(endIso.getHours() + duration.value)
    }

    const bookingHours = isManualTimeSelected.value
      ? calculateHourDifference(manualStartTime.value, manualEndTime.value)
      : duration.value

    // Используем pph из формы для админа/агента/менеджера, или displayedPrice для остальных
    const hourlyPrice = isAdminOrAgentOrManager.value && pph.value > 0
      ? pph.value
      : displayedPrice.value

    const payload = {
      boat_id: props.boatId,
      start_time: startIso.toISOString(),
      end_time: endIso.toISOString(),
      price: hourlyPrice * bookingHours,
      pph: hourlyPrice,
      peoples: peopleCount.value,
      status: 'pending',
      guest_name: guestName.value.trim(),
      guest_phone: needsPhoneField.value ? guestPhone.value.trim() : null,
      guest_note: guestNote.value,
      prepayment: isAdminOrAgentOrManager.value ? prepayment.value : null
    } as const

    // Создаем бронирование через API (с уведомлениями)
    const response = await $fetch('/api/bookings', {
      method: 'POST',
      body: payload
    })

    if (response.status === 201) {
      toast.success('Бронирование успешно создано')
      resetForm()
      emit('bookingCreated')
    } else {
      toast.error('Ошибка бронирования')
    }
  } catch (error) {
    console.error('Error in bookSlot:', error)
    toast.error('Произошла ошибка при бронировании')
  }
}

function resetForm() {
  selectedSlot.value = null
  isManualTimeSelected.value = false
  manualStartTime.value = ''
  manualEndTime.value = ''
  duration.value = 1
  guestName.value = ''
  guestPhone.value = ''
  peopleCount.value = 1
  pph.value = 0
  prepayment.value = 0
  guestNote.value = ''
}

// --- LIFECYCLE ---
watch(selectedDate, () => {
  selectedSlot.value = null
  isManualTimeSelected.value = false
  manualStartTime.value = ''
  manualEndTime.value = ''
  fetchBookings()
})

onMounted(() => {
  // Загружаем бронирования на выбранную дату
  fetchBookings()
})
</script>
