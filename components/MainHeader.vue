<template>
  <header class="shadow-sm py-2">
    <div class="container mx-auto px-4">
      <div class="flex justify-between items-center">
        <!-- Логотип и название -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <UIcon name="i-lucide-anchor" class="w-6 h-6" />
          <span class="font-semibold text-lg">BoatRent</span>
        </NuxtLink>

        <!-- Основная навигация -->
        <div class="hidden md:flex items-center gap-4">
          <NuxtLink to="/" class="hover:text-primary transition">
            Лодки
          </NuxtLink>
          <NuxtLink to="/group-tours" class="hover:text-primary transition">
            Групповые поездки
          </NuxtLink>
        </div>

        <!-- Действия пользователя -->
        <div class="flex items-center gap-3">
          <!-- Профиль пользователя -->
          <div v-if="isAuthenticated && profile">
            <!-- Клик по аватару ведет в профиль -->
            <NuxtLink to="/profile" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <UAvatar :src="userAvatar" :alt="profile.name || profile.email || 'Пользователь'" size="sm" />
              <div class="hidden sm:block">
                <div class="text-sm font-medium">{{ profile.name || 'Пользователь' }}</div>
                <div class="text-xs opacity-70">{{ userRoleLabel }}</div>
              </div>
            </NuxtLink>
          </div>

          <!-- Telegram Auth -->
          <template v-else>
            <UButton variant="solid" to="/telegram-auth" icon="i-heroicons-device-phone-mobile">
              Войти через Telegram
            </UButton>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTelegramAuth } from '~/composables/useTelegramAuth'

// Состояние
const { profile, isAuthenticated } = useTelegramAuth()

// Алиас для совместимости
const user = computed(() => profile.value)
const isAdmin = computed(() => profile.value?.role === 'admin')

// Вычисляемые свойства
const userAvatar = computed<string>(() => {
  if (profile.value?.name) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.value.name)}`
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.value?.email || 'User')}`
})

const userRoleLabel = computed(() => {
  const role = profile.value?.role || 'user'
  switch (role) {
    case 'admin': return 'Администратор'
    case 'agent': return 'Агент'
    case 'manager': return 'Менеджер'
    default: return 'Пользователь'
  }
})
</script>
