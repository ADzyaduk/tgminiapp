<template>
  <section class="mb-8 space-y-6">
    <header class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold">Управление бронированиями групповых поездок</h2>
      <UButton variant="ghost" icon="i-heroicons-arrow-path" aria-label="Обновить" @click="loadGroupBookings"
        :loading="loading" color="primary" />
    </header>

    <!-- Лоадер или список -->
    <div>
      <div v-if="loading" class="text-center py-8">
        <UProgress animation="carousel" color="primary" />
        <p class="mt-2">Загрузка бронирований...</p>
      </div>

      <div v-else>
        <div v-if="groupedBookings.length">
          <div v-for="group in groupedBookings" :key="group.trip_id" class="mb-8 p-4 rounded-lg shadow-sm bg-muted">
            <h3 class="text-lg font-semibold flex items-center gap-2 mb-4">
              <UIcon name="i-heroicons-user-group" />
              {{ group.trip_name }} ({{ formatDate(group.trip_start_time) }} {{ formatTime(group.trip_start_time) }})
              <UBadge variant="soft" color="neutral">{{ group.bookings.length }} бронир.</UBadge>
            </h3>

            <div class="space-y-4">
              <UCard v-for="booking in group.bookings" :key="booking.id">
                <template #header>
                  <div class="flex items-center justify-between">
                    <h4 class="font-medium">{{ booking.guest_name }}</h4>
                    <UBadge :color="getBookingStatusColor(booking.status)" variant="subtle">{{
                      formatBookingStatus(booking.status) }}</UBadge>
                  </div>
                </template>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><span class="text-gray-500">Телефон:</span> {{ booking.guest_phone || '-' }}</p>
                    <p><span class="text-gray-500">Взрослые:</span> {{ booking.adult_count }}</p>
                    <p><span class="text-gray-500">Дети:</span> {{ booking.child_count }}</p>
                  </div>
                  <div>
                    <p><span class="text-gray-500">Сумма:</span> {{ formatPrice(booking.total_price) }}</p>
                    <p v-if="booking.notes"><span class="text-gray-500">Примечания:</span> {{ booking.notes }}</p>
                    <p class="text-xs text-gray-400 mt-1">Создано: {{ formatDate(booking.created_at, true) }}</p>
                  </div>
                </div>

                <!-- Действия с бронированием (пример) -->
                <template #footer v-if="booking.status === 'confirmed'">
                  <div class="flex gap-2">
                    <UButton size="xs" color="error" variant="outline"
                      @click="updateBookingStatus(booking.id, 'cancelled')" :loading="updatingStatus === booking.id">
                      Отменить бронь
                    </UButton>
                    <UButton size="xs" color="success" variant="outline"
                      @click="updateBookingStatus(booking.id, 'completed')" :loading="updatingStatus === booking.id">
                      Завершить (оплачено)
                    </UButton>
                  </div>
                </template>
              </UCard>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-12 rounded-lg shadow-sm bg-muted">
          <UIcon name="i-heroicons-ticket" class="w-12 h-12 mx-auto mb-4" />
          <p class="text-lg">Нет бронирований для групповых поездок этой лодки.</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabaseClient } from '#imports'
import { format, parseISO, isSameDay } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Database } from '~/types/supabase'
import { useDateStore } from '~/stores/useDateStore'

type GroupBookingRow = Database['public']['Tables']['group_trip_bookings']['Row']
type GroupTripRow = Database['public']['Tables']['group_trips']['Row']

interface EnrichedGroupBooking extends GroupBookingRow {
  group_trips: Pick<GroupTripRow, 'name' | 'start_time' | 'end_time'> | null
}

interface GroupedBookingDetail {
  trip_id: string;
  trip_name: string;
  trip_start_time: string;
  bookings: GroupBookingRow[];
}

const props = defineProps<{ boatId: string }>()

const supabase = useSupabaseClient<Database>()
const toast = useToast()
const dateStore = useDateStore()

const bookings = ref<EnrichedGroupBooking[]>([])
const loading = ref(true)
const updatingStatus = ref<string | null>(null)

const loadGroupBookings = async () => {
  loading.value = true
  try {
    // Получаем выбранную дату
    const selectedDateObj = dateStore.selectedDate.toDate('UTC')
    const startOfDay = new Date(selectedDateObj)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(selectedDateObj)
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('group_trip_bookings')
      .select(`
        *,
        group_trips!inner(
          name,
          start_time,
          end_time,
          boat_id
        )
      `)
      .eq('group_trips.boat_id', props.boatId)
      .gte('group_trips.start_time', startOfDay.toISOString())
      .lte('group_trips.start_time', endOfDay.toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error
    bookings.value = data as EnrichedGroupBooking[]
  } catch (err: any) {
    console.error('Ошибка загрузки бронирований групповых поездок:', err)
    toast.add({ title: 'Ошибка', description: 'Не удалось загрузить бронирования.', color: 'error' })
  } finally {
    loading.value = false
  }
}

const groupedBookings = computed(() => {
  const groups: Record<string, GroupedBookingDetail> = {}

  for (const booking of bookings.value) {
    if (booking.group_trips) {
      const tripId = booking.group_trip_id
      if (!groups[tripId]) {
        groups[tripId] = {
          trip_id: tripId,
          trip_name: booking.group_trips.name,
          trip_start_time: booking.group_trips.start_time,
          bookings: []
        }
      }
      groups[tripId].bookings.push(booking)
    }
  }
  return Object.values(groups).sort((a, b) => new Date(b.trip_start_time).getTime() - new Date(a.trip_start_time).getTime());
})

const formatDate = (dateString?: string | null, includeTime = false) => {
  if (!dateString) return ''
  try {
    const formatString = includeTime ? 'dd MMM yyyy, HH:mm' : 'dd MMM yyyy'
    return format(parseISO(dateString), formatString, { locale: ru })
  } catch (e) {
    return dateString
  }
}

const formatTime = (dateString?: string | null) => {
  if (!dateString) return ''
  try {
    return format(parseISO(dateString), 'HH:mm', { locale: ru })
  } catch (e) {
    return dateString
  }
}

const formatPrice = (price?: number | null) => {
  if (price === null || price === undefined) return '-'
  return `${price.toLocaleString('ru-RU')} ₽`
}

const formatBookingStatus = (status: string | null) => {
  if (!status) return 'Неизвестен'
  const statuses: Record<string, string> = {
    confirmed: 'Подтверждено',
    completed: 'Завершено',
    cancelled: 'Отменено'
  }
  return statuses[status] || status
}

const getBookingStatusColor = (status: string | null) => {
  if (!status) return 'gray'
  const colors: Record<string, string> = {
    confirmed: 'blue',
    completed: 'green',
    cancelled: 'red'
  }
  return colors[status] || 'gray'
}

const updateBookingStatus = async (bookingId: string, newStatus: 'confirmed' | 'completed' | 'cancelled') => {
  updatingStatus.value = bookingId

  // Оптимистичное обновление
  const backup = bookings.value.slice()
  const index = bookings.value.findIndex(b => b.id === bookingId)
  if (index !== -1) {
    bookings.value[index].status = newStatus
  }

  try {
    // Используем наш API endpoint для обновления статуса с уведомлениями
    const response: any = await $fetch(`/api/group-trip-bookings/${bookingId}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    })

    // Проверяем успешность операции
    if (response && (response.success === true || response.data)) {
      toast.add({
        title: 'Успешно',
        description: `Статус обновлен на ${formatBookingStatus(newStatus)}. Уведомления отправлены!`,
        color: 'green' as any
      })
    } else {
      // Если API вернул ошибку
      bookings.value = backup
      const errorMessage = response?.error || 'Не удалось обновить статус'
      toast.add({ title: 'Ошибка', description: errorMessage, color: 'red' as any })
    }
  } catch (error: any) {
    console.error('Ошибка обновления статуса группового бронирования:', error)
    bookings.value = backup

    // Обработка ошибок
    let errorMessage = 'Ошибка обновления статуса'
    if (error.data?.error) {
      errorMessage = error.data.error
    } else if (error.statusCode === 401) {
      errorMessage = 'Нет прав для изменения статуса'
    } else if (error.statusCode === 404) {
      errorMessage = 'Бронирование не найдено'
    }

    toast.add({ title: 'Ошибка', description: errorMessage, color: 'red' as any })
  } finally {
    updatingStatus.value = null
  }
}

// Добавляем watch для перезагрузки бронирований при изменении даты
watch(() => dateStore.selectedDate, () => {
  loadGroupBookings()
})

onMounted(() => {
  loadGroupBookings()
})

</script>

<style scoped>
/* Стили можно добавить по необходимости */
</style>
