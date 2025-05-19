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
      <UAlert
        v-else-if="boatError"
        title="Ошибка"
        description="Не удалось загрузить информацию о лодке"
        variant="solid"
      />
      <template v-else-if="boat">
        <BoatInfo :boat="boat" :user="user" />
  
        <ClientOnly>
          <BookingCalendar
            :boat="boat"
            :user="user"
            :boatId="boat.id"
            @bookingCreated="refreshBoat"
          />
          
          <!-- Добавляем систему отзывов -->
          <div class="mt-8">
            <RatingSystem :boatId="boat.id" :ownerUserId="boat.owner_id" />
          </div>
        </ClientOnly>
  
        <div v-if="isAdmin || isManager">
          <BookingsManager :boatId="boat.id" @boatUpdated="refreshBoat" />
        </div>
      </template>
  
      <UAlert
        v-else
        title="Не найдено"
        description="Лодка не существует"
        variant="solid"
      />
    </div>
  </template>
  
  <script setup lang="ts">
  import { computed } from 'vue'
  import { useAuth } from '~/composables/useAuth'
  import { useBoat } from '~/composables/useBoat'
  import { useManager } from '~/composables/useManager'
  import BoatInfo from '~/components/BoatInfo.vue'
  import BookingCalendar from '~/components/BookingCalendar.vue'
  import BookingsManager from '~/components/BookingsManager.vue'
  import RatingSystem from '~/components/RatingSystem.vue'
  
  definePageMeta({
    layout: 'default'
  })
  
  const { user, isAdmin, loading: authLoading, signOut } = useAuth()
  const { boat, loading: boatLoading, error: boatError, fetchBoat } = useBoat()
  const { isManager } = useManager(
    computed(() => user.value?.id ?? null),
    computed(() => boat.value?.id ?? null)
  )
  
  // обновить лодку после нового бронирования
  function refreshBoat() {
    fetchBoat()
  }
  </script>
  