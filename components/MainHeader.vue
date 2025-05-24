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
          <NuxtLink to="/" class="text-gray-700 hover:text-primary transition">
            Лодки
          </NuxtLink>
          <NuxtLink to="/group-tours" class="text-gray-700 hover:text-primary transition">
            Групповые поездки
          </NuxtLink>
        </div>
        
        <!-- Действия пользователя -->
        <div class="flex items-center gap-3">
          <!-- Профиль пользователя -->
          <div v-if="user" class="relative">
            <UAvatar
              :src="userAvatar"
              :alt="user.email || 'Пользователь'"
              size="sm"
              class="cursor-pointer"
              @click="toggleUserMenu"
            />
            
            <div v-if="showUserMenu" class="absolute right-0 top-full mt-2 w-64 bg-white shadow-lg rounded-md overflow-hidden z-50">
              <div class="p-3 border-b">
                <div class="font-medium">{{ user.email }}</div>
                <div class="text-xs">Роль: {{ userRoleLabel }}</div>
              </div>
              <UButton
                v-for="(item, index) in userMenuItems.filter(item => !item.isProfile)"
                :key="index"
                :to="item.to"
                :variant="item.variant"
                :icon="item.icon"
                :class="item.class"
                block
                @click="item.click ? item.click() : null"
              >
                {{ item.label }}
              </UButton>
            </div>
          </div>
          
          <!-- Кнопки аутентификации -->
          <template v-else>
            <UButton variant="ghost" to="/login">Войти</UButton>
            <UButton variant="solid" to="/register">Регистрация</UButton>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '~/composables/useAuth'

// Состояние
const { user, profile, isAdmin, signOut } = useAuth()
const showUserMenu = ref(false)

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

// Закрывать меню при клике снаружи
function closeUserMenu(e: MouseEvent) {
  if (showUserMenu.value) {
    showUserMenu.value = false
  }
}

// Обработчик кликов вне меню
onMounted(() => {
  document.addEventListener('click', closeUserMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeUserMenu)
})

// Вычисляемые свойства
const userAvatar = computed<string>(() => {
  if (user.value && 'avatar' in user.value && user.value.avatar) return user.value.avatar as string;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.value?.email || 'User')}`;
})

const userRoleLabel = computed(() => {
  const role = profile.value?.role || user.value?.user_metadata?.role || 'user'
  switch (role) {
    case 'admin': return 'Администратор'
    case 'manager': return 'Менеджер'
    case 'agent': return 'Агент'
    default: return 'Пользователь'
  }
})

// Типы для элементов меню
type MenuItemVariant = 'ghost' | 'link' | 'solid' | 'outline' | 'soft' | 'subtle' | undefined;
interface MenuItem {
  isProfile?: boolean;
  label?: string;
  to?: string;
  icon?: string;
  variant?: MenuItemVariant;
  class?: string;
  click?: () => void;
}

// Пункты выпадающего меню
const userMenuItems = computed((): MenuItem[] => [
  {
    isProfile: true
  },
  {
    label: 'Профиль',
    to: '/profile',
    icon: 'i-heroicons-user',
    variant: 'ghost' as MenuItemVariant
  },
  ...(isAdmin.value ? [
    {
      label: 'Админ-панель',
      to: '/admin',
      icon: 'i-heroicons-cog-6-tooth',
      variant: 'ghost' as MenuItemVariant
    }
  ] : []),
  {
    label: 'Мои бронирования',
    to: '/bookings',
    icon: 'i-heroicons-calendar',
    variant: 'ghost' as MenuItemVariant
  },
  {
    label: 'Групповые поездки',
    to: '/group-tours',
    icon: 'i-heroicons-user-group',
    variant: 'ghost' as MenuItemVariant
  },
  {
    label: 'Выйти',
    icon: 'i-heroicons-arrow-right-on-rectangle',
    variant: 'ghost' as MenuItemVariant,
    class: 'border-t mt-2 pt-2',
    click: signOut
  }
])
</script> 