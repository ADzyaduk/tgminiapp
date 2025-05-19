<template>
  <UCard class="mb-4 p-4 hover:shadow-lg transition-shadow">
    <div class="flex justify-between items-center mb-3">
      <UBadge :color="statusInfo.color" variant="soft">
        {{ statusInfo.label }}
      </UBadge>
      <span class="text-xs text-muted">ID: {{ id }}</span>
    </div>

    <div class="flex justify-between mb-4">
      <div>
        <div class="text-lg font-semibold">{{ price }}₽</div>
        <div class="text-sm text-muted">Предоплата: {{ prepayment }}₽</div>
        <div class="text-sm text-muted">Остаток: {{ balance }}₽</div>
      </div>
      <div class="text-right space-y-1">
        <div class="text-sm text-muted">Цена за час: {{ pph }}₽</div>
        <div class="text-sm text-muted">Часов: {{ durationHours }}</div>
        <div class="text-sm text-muted">Гостей: {{ peoples }}</div>
      </div>
    </div>

    <div class="mb-4">
      <p class="font-medium">Время бронирования</p>
      <p>{{ formattedRange }}</p>
    </div>

    <div class="mb-4">
      <p class="font-medium">Гость</p>
      <p>{{ guest_name }}</p>
      <p v-if="guest_note" class="text-sm text-muted">{{ guest_note }}</p>
      
      <div v-if="hasProfileData" class="mt-2 pt-2 border-t border-gray-100">
        <p class="font-medium text-sm text-secondary">Заброинровал:</p>
        <p class="text-sm">Имя: {{ profileName }}</p>
        <p class="text-sm">Телефон: {{ profilePhone }}</p>
      </div>
    </div>

    <div v-if="status === 'pending'" class="flex gap-2 justify-end">
      <UButton
        aria-label="Подтвердить бронирование"
        color="primary"
        icon="i-heroicons-check"
        @click="$emit('update-status', id, 'confirmed')"
      >
        Подтвердить
      </UButton>
      <UButton
        aria-label="Отменить бронирование"
        color="warning"
        variant="outline"
        icon="i-heroicons-x-mark"
        @click="$emit('update-status', id, 'cancelled')"
      >
        Отменить
      </UButton>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import type { Database } from '~/types/supabase'
import dayjs from 'dayjs'

type BookingRow = Database['public']['Tables']['bookings']['Row']
type Booking = BookingRow & {
  guest_name: string
  guest_note: string | null
  pph: number
  peoples: number
  prepayment: number | null
  profile?: {
    name: string | null
    phone: string | null
  }
}

const props = defineProps<{ booking: Booking }>()
const { id, status, price, prepayment: prep, pph, peoples, start_time, end_time, guest_name, guest_note, profile } = toRefs(props.booking)

type StatusType = 'pending' | 'confirmed' | 'cancelled'

const statusMeta = {
  pending:   { label: 'На рассмотрении', color: 'warning' },
  confirmed: { label: 'Подтверждено',    color: 'success'  },
  cancelled: { label: 'Отменено',        color: 'error'    }
} as const

const statusInfo = computed(() => statusMeta[status.value as StatusType])

const prepayment = computed(() => prep.value ?? 0)
const balance    = computed(() => price.value - prepayment.value)

const start = computed(() => dayjs(start_time.value))
const end   = computed(() => dayjs(end_time.value))

const formattedRange  = computed(() => `${start.value.format('DD.MM.YY HH:mm')}–${end.value.format('HH:mm')}`)
const durationHours   = computed(() => end.value.diff(start.value, 'hour'))

const hasProfileData = computed(() => !!profile.value && (!!profile.value?.name || !!profile.value?.phone))
const profileName = computed(() => profile.value?.name || 'Не указано')
const profilePhone = computed(() => profile.value?.phone || 'Не указано')
</script>
