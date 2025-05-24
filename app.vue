<template>
  <UApp>
    <!-- Показываем загрузку пока инициализируется auth -->
    <div v-if="initializing" class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div class="text-center">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
        <p class="text-gray-600 dark:text-gray-400">Инициализация...</p>
      </div>
    </div>
    
    <!-- Основное приложение после инициализации -->
    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { useAuth } from '~/composables/useAuth'

const { initializing } = useAuth()
</script>

<style>
:root {
  /* Базовые стили */
  font-family: Arial, sans-serif;
}
</style>
