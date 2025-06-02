<template>
  <div class="container mx-auto p-4">
    <UCard class="mb-4">
      <template #header>
        <div class="flex justify-between items-center">
          <h1 class="text-xl font-semibold">Админ-панель: Управление приглашениями</h1>
          <NuxtLink to="/admin">
            <UButton variant="ghost" color="neutral" icon="i-heroicons-arrow-left">
              Назад к панели
            </UButton>
          </NuxtLink>
        </div>
      </template>
    </UCard>

    <div v-if="!isAuthenticated" class="text-center py-8">
      <p class="mb-4">Войдите через Telegram для доступа к админ-панели</p>
      <UButton to="/telegram-auth" color="primary">
        Войти через Telegram
      </UButton>
    </div>

    <UAlert v-else-if="!isAdmin" color="error" title="Доступ запрещен" class="my-8">
      У вас нет доступа к этой странице. Требуются права администратора.
    </UAlert>

    <template v-else>
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Приглашения менеджеров</h2>
        </template>
        <p>Раздел управления приглашениями менеджеров. (В разработке)</p>
        <!-- TODO: Реализовать функционал отображения и управления приглашениями -->
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTelegramAuth } from '~/composables/useTelegramAuth'

const { profile, isAuthenticated } = useTelegramAuth()

const isAdmin = computed(() => profile.value?.role === 'admin')
</script>
