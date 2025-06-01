<template>
  <section class="mb-8 space-y-6">
    <!-- Access check -->
    <div v-if="!hasAccess" class="text-center py-12 rounded-lg shadow-sm bg-muted">
      <UIcon name="i-heroicons-lock-closed" class="w-12 h-12 mx-auto mb-4 text-red-500" />
      <p class="text-lg">Доступ запрещен</p>
      <p class="text-sm text-gray-500">У вас нет прав для управления бронированиями этой лодки</p>
    </div>

    <div v-else>
      <header class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold">Управление бронированиями</h2>
      </header>

      <!-- Фильтры и календарь -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 rounded-lg shadow-sm bg-muted">
        <ClientOnly>
          <div class="flex flex-col items-center">
            <!-- Календарь теперь показывается только в BookingCalendar -->
            <p class="text-lg font-semibold">Выбранная дата:</p>
            <p class="text-2xl font-bold mt-2">{{ formattedDate }}</p>
          </div>
        </ClientOnly>

        <div class="flex flex-wrap gap-2">
          <UButton v-for="f in FILTER_KEYS" :key="f" :variant="activeFilter === f ? 'solid' : 'outline'" size="sm"
            :color="activeFilter === f ? 'primary' : 'neutral'" @click="activeFilter = f">
            {{ FILTERS[f] }}
          </UButton>

          <UButton variant="ghost" icon="i-heroicons-arrow-path" aria-label="Обновить" @click="loadBookings"
            :loading="loading" color="primary" />
        </div>
      </div>

      <!-- Лоадер или список -->
      <div>
        <div v-if="loading" class="text-center py-8">
          <UProgress animation="carousel" color="primary" />
          <p class="mt-2">Загрузка...</p>
        </div>

        <div v-else>
          <div v-if="groups.length || cancelledBookings.length">
            <!-- Отображаем активные группы -->
            <div v-for="g in groups" :key="g.status" class="mb-8 p-4 rounded-lg shadow-sm bg-muted">
              <h3 class="text-lg font-semibold flex items-center gap-2 mb-4">
                <span class="w-3 h-3 rounded-full" :class="statusConfig[g.status].class"></span>
                {{ statusConfig[g.status].title }}
                <UBadge variant="soft" color="neutral">{{ g.bookings.length }}</UBadge>
              </h3>

              <TransitionGroup name="list" tag="div">
                <BookingCard v-for="b in g.bookings" :key="b.id" :booking="b" @update-status="updateStatus"
                  class="mb-4" />
              </TransitionGroup>
            </div>

            <!-- Аккордеон с отмененными бронированиями -->
            <UAccordion v-if="cancelledBookings.length > 0" :items="[{
              label: `Отмененные бронирования (${cancelledBookings.length})`,
              icon: 'i-heroicons-x-circle',
              slot: 'cancelled'
            }]" class="mb-8">
              <template #cancelled>
                <div class="space-y-4">
                  <BookingCard v-for="b in cancelledBookings" :key="b.id" :booking="b" @update-status="updateStatus" />
                </div>
              </template>
            </UAccordion>
          </div>
          <div v-else class="text-center py-12 rounded-lg shadow-sm bg-muted">
            <UIcon name="i-heroicons-calendar" class="w-12 h-12 mx-auto mb-4" />
            <p class="text-lg">Бронирований на {{ formattedDate }} нет</p>
          </div>
        </div>
      </div>

      <!-- Back button -->
      <div class="mb-4">
        <UButton icon="i-heroicons-arrow-left" variant="soft" @click="goBack" class="mb-2">
          Вернуться к списку
        </UButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { CalendarDate } from '@internationalized/date'
import type { Database } from '~/types/supabase'
import { useSupabaseClient } from '#imports'
import { useDateStore } from '~/stores/useDateStore'
import { useAuth } from '~/composables/useAuth'
import { useManager } from '~/composables/useManager'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type Booking = BookingRow & { profile: { name: string; phone: string } }

enum Status {
  pending = 'pending',
  confirmed = 'confirmed',
  cancelled = 'cancelled'
}

enum Filter {
  all = 'all',
  pending = 'pending'
}

// Константы для фильтров и мета-данных статусов
const FILTERS = {
  [Filter.all]: 'Все',
  [Filter.pending]: 'Новые'
} as const
const FILTER_KEYS = Object.keys(FILTERS) as Filter[]

const statusConfig = {
  [Status.pending]: { title: 'Ожид.', class: '' },
  [Status.confirmed]: { title: 'Подтв.', class: '' },
  [Status.cancelled]: { title: 'Отмн.', class: '' }
}

// Props и подключаем клиенты Supabase и Toast
const props = defineProps<{ boatId: string }>()
const supabase = useSupabaseClient<Database>()
// Используем встроенный тост из Nuxt UI без специального импорта
const toast = {
  error: (message: string) => useNuxtApp().$toast?.error?.(message),
  success: (message: string) => useNuxtApp().$toast?.success?.(message)
}

// Access check
const { user, isAdmin } = useAuth()
const { isManager } = useManager(
  computed(() => user.value?.id ?? null),
  computed(() => props.boatId ?? null)
)

// Проверка доступа - администратор или менеджер конкретной лодки
const hasAccess = computed(() => {
  if (!user.value) return false
  return isAdmin.value || isManager.value
})

// Используем Pinia store для даты
const dateStore = useDateStore()
// Получаем значение даты из store
const selectedDate = computed(() => dateStore.selectedDate)

// Данные
const bookings = ref<Booking[]>([])
const loading = ref(false)
const activeFilter = ref<Filter>(Filter.all)

// Форматированная дата для вывода
const formattedDate = computed(() => {
  try {
    if (!selectedDate.value) {
      return 'Выберите дату'
    }
    const iso = selectedDate.value.toDate('UTC').toISOString().slice(0, 10)
    const [y, m, d] = iso.split('-')
    return `${d}.${m}.${y.slice(-2)}`
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Неверная дата'
  }
})

// Function to handle going back
function goBack() {
  window.history.length > 1 ? window.history.back() : null
}

// Загрузка бронирований на выбранную дату
async function loadBookings() {
  loading.value = true

  try {
    if (!selectedDate.value) {
      loading.value = false
      return
    }

    const js = selectedDate.value.toDate('UTC')
    const dayStart = new Date(js); dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(js); dayEnd.setUTCHours(23, 59, 59, 999)

    // Ищем бронирования, где:
    // 1. Начало бронирования до конца дня И
    // 2. Конец бронирования после начала дня
    // Это даст нам все бронирования, которые пересекаются с выбранным днем
    const { data, error } = await supabase
      .from('bookings')
      .select('*, profile:user_id(name, phone)')
      .eq('boat_id', props.boatId)
      .lt('start_time', dayEnd.toISOString())
      .gt('end_time', dayStart.toISOString())
      .order('start_time', { ascending: true })

    if (error) {
      bookings.value = []
      toast.error('Не удалось загрузить бронирования')
    } else {
      bookings.value = data as Booking[]
    }
  } catch (e) {
    console.error('Ошибка загрузки бронирований:', e)
    bookings.value = []
    toast.error('Ошибка загрузки')
  } finally {
    loading.value = false
  }
}

// Группировка и фильтрация по статусу
const groups = computed(() => {
  const map = bookings.value.reduce<Record<Status, Booking[]>>(
    (acc: Record<Status, Booking[]>, b: Booking) => {
      (acc[b.status as Status] ||= []).push(b)
      return acc
    },
    { pending: [], confirmed: [], cancelled: [] }
  )

  // Возвращаем только активные статусы (не отмененные)
  return (Object.values(Status) as Status[])
    .filter(status => status !== Status.cancelled) // Исключаем отмененные
    .map(status => ({ status, bookings: map[status] }))
    .filter(g =>
      g.bookings.length > 0 &&
      (activeFilter.value === Filter.all || g.status === Status.pending)
    )
})

// Отдельное computed свойство для отмененных бронирований
const cancelledBookings = computed(() => {
  return bookings.value.filter(b => b.status === Status.cancelled)
})

// Оптимистичное обновление статуса
async function updateStatus(id: string, newStatus: Status) {
  const backup = bookings.value.slice()
  bookings.value = bookings.value.map((b: any) =>
    b.id === id ? { ...b, status: newStatus } : b
  )

  try {
    console.log('🔍 Updating booking status:', { id, newStatus })

    // Используем наш API endpoint вместо прямого обращения к Supabase
    const response: any = await $fetch(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    })

    console.log('🔍 API Response:', response)

    // Проверяем успешность операции
    if (response && (response.success === true || response.data)) {
      toast.success('Статус обновлён. Уведомления отправлены!')
    } else {
      // Если API вернул ошибку
      bookings.value = backup
      const errorMessage = response?.error || 'Не удалось обновить статус'
      console.error('🔍 API Error:', errorMessage)
      toast.error(errorMessage)
    }
  } catch (error: any) {
    console.error('🔍 Catch Error:', error)
    bookings.value = backup

    // Обработка ошибок
    let errorMessage = 'Ошибка обновления статуса'

    if (error.data?.error) {
      errorMessage = error.data.error
    } else if (error.statusCode === 401) {
      errorMessage = 'Доступ запрещен'
    } else if (error.statusCode === 403) {
      errorMessage = 'У вас нет прав для изменения этого бронирования'
    } else if (error.statusCode === 404) {
      errorMessage = 'Бронирование не найдено'
    }

    toast.error(errorMessage)
  }
}

// Реакция на смену даты
watch(selectedDate, loadBookings)

onMounted(() => {
  // Проверяем, не находится ли выбранная дата в прошлом
  // Если да, устанавливаем текущую дату
  const today = new Date()
  const currentDate = new CalendarDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  )

  const selectedDateJs = selectedDate.value.toDate('UTC')
  const todayJs = today

  // Если выбранная дата раньше сегодня, обновляем её
  if (selectedDateJs < todayJs) {
    dateStore.setDate(currentDate)
  }

  loadBookings()
})

const searchBookings = async (startDate, endDate) => {
  try {
    const dayStart = new Date(startDate)
    dayStart.setHours(0, 0, 0, 0)

    const dayEnd = new Date(endDate)
    dayEnd.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, status, created_at,
        profiles:user_id (
          id, name, email, phone
        )
      `)
      .eq('boat_id', props.boatId)
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString())
      .order('start_time', { ascending: true })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Ошибка поиска бронирований:', error)
    return []
  }
}
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

:deep(.u-calendar) {
  @apply mx-auto;
}

:deep(.u-calendar-header) {
  @apply justify-center;
}

:deep(.u-calendar-title) {
  @apply text-center;
}
</style>
