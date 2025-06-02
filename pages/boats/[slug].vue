<template>
  <div class="container mx-auto p-4">
    <!-- Навигация -->
    <div class="mb-4">
      <NuxtLink to="/">
        <UButton icon="i-heroicons-arrow-left" variant="ghost" class="flex items-center">
          <span>Вернуться к списку</span>
        </UButton>
      </NuxtLink>
    </div>

    <!-- Лодка -->
    <div v-if="boatLoading" class="text-center py-8">
      <UProgress animation="carousel" />
    </div>
    <UAlert v-else-if="boatError" title="Ошибка" description="Не удалось загрузить информацию о лодке"
      variant="solid" />
    <template v-else-if="boat">
      <BoatInfo :boat="boat" :user="userWithProfile" />

      <ClientOnly>
        <UTabs v-model="activeTabKey" :items="tabItems" class="mt-6">
          <template #content="{ item }">
            <!-- Индивидуальная аренда -->
            <div v-if="item.value === 'rental'">
              <BookingCalendar :boat="boat" :user="userWithProfile" :boatId="boat.id" @bookingCreated="refreshBoat" />
            </div>

            <!-- Групповые поездки -->
            <div v-else-if="item.value === 'group'">
              <GroupTripList :boatId="boat.id" />
            </div>
          </template>
        </UTabs>

        <!-- Добавляем систему отзывов -->
        <div class="mt-8">
          <RatingSystem :boatId="boat.id" :ownerUserId="boat.owner_id" />
        </div>
      </ClientOnly>

      <div v-if="isAdmin || isManager" class="mt-8">
        <UTabs v-model="activeManagerTabKey" :items="managerTabItems" class="mt-6">
          <template #content="{ item }">
            <!-- Управление бронированиями -->
            <div v-if="item.value === 'bookings'">
              <BookingsManager :boatId="boat.id" @boatUpdated="refreshBoat" />
            </div>
            <div v-else-if="item.value === 'groupTripBookings'">
              <GroupTripBookingsManager :boatId="boat.id" />
            </div>

            <!-- Управление групповыми поездками -->
            <div v-else-if="item.value === 'groupTrips'">
              <GroupTripManager :boatId="boat.id" />
            </div>
          </template>
        </UTabs>
      </div>
    </template>

    <UAlert v-else title="Не найдено" description="Лодка не существует" variant="solid" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBoat } from '~/composables/useBoat'
import BoatInfo from '~/components/BoatInfo.vue'
import BookingCalendar from '~/components/BookingCalendar.vue'
import BookingsManager from '~/components/BookingsManager.vue'
import RatingSystem from '~/components/RatingSystem.vue'
import GroupTripList from '~/components/GroupTripList.vue'
import GroupTripManager from '~/components/GroupTripManager.vue'
import GroupTripBookingsManager from '~/components/GroupTripBookingsManager.vue'

definePageMeta({
  layout: 'default'
})

const { profile, isAuthenticated } = useTelegramAuth()
const { boat, loading: boatLoading, error: boatError, fetchBoat } = useBoat()

// Проверяем права админа
const isAdmin = computed(() => profile.value?.role === 'admin')

// Проверяем, является ли пользователь менеджером этой лодки
const isManager = ref(false)

// Функция проверки менеджера лодки
const checkManager = async () => {
  if (!profile.value?.id || !boat.value?.id) {
    isManager.value = false
    return
  }

  try {
    const result = await $fetch('/api/check-boat-manager', {
      method: 'POST',
      body: {
        boat_id: boat.value.id,
        user_id: profile.value.id
      }
    }) as any

    isManager.value = result.isManager || false
  } catch (error) {
    console.error('Error checking manager status:', error)
    isManager.value = false
  }
}

// Наблюдаем за изменениями лодки и профиля
watch([() => boat.value?.id, () => profile.value?.id], checkManager, { immediate: true })

// Объединяем данные пользователя с профилем для обратной совместимости
const userWithProfile = computed(() => {
  if (!profile.value) return null
  return {
    id: profile.value.id,
    email: profile.value.email || '',
    name: profile.value.name || '',
    role: profile.value.role || 'user',
    telegram_id: profile.value.telegram_id
  }
})

// Active tab keys
const activeTabKey = ref('rental')
const activeManagerTabKey = ref('bookings')

// Tabs configuration
const tabs = [
  { key: 'rental', label: 'Индивидуальная аренда', icon: 'i-heroicons-calendar' },
  { key: 'group', label: 'Групповые поездки', icon: 'i-heroicons-user-group' }
]

const managerTabs = [
  { key: 'bookings', label: 'Управление бронированиями', icon: 'i-heroicons-calendar' },
  { key: 'groupTripBookings', label: 'Бронирования групп', icon: 'i-heroicons-ticket' },
  { key: 'groupTrips', label: 'Управление групповыми поездками', icon: 'i-heroicons-users' }
]

// Format tabs for UTabs component
const tabItems = computed(() =>
  tabs.map(tab => ({
    label: tab.label,
    icon: tab.icon,
    value: tab.key
  }))
)

const managerTabItems = computed(() =>
  managerTabs.map(tab => ({
    label: tab.label,
    icon: tab.icon,
    value: tab.key
  }))
)

// обновить лодку после нового бронирования
function refreshBoat() {
  fetchBoat()
}
</script>
