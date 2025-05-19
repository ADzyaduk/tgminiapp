<template>
  <div class="relative">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-heroicons-bell"
      :trailing="unreadCount > 0"
      :trailing-icon="unreadCount > 0 ? 'i-heroicons-dot-solid' : undefined"
      :trailing-class="unreadCount > 0 ? 'text-error' : ''"
      @click="toggleDropdown"
    />
    
    <div v-if="showDropdown" class="absolute right-0 top-full mt-2 w-80 bg-white shadow-lg rounded-md overflow-hidden z-50">
      <div v-for="(item, index) in dropdownItems" :key="index">
        <div v-if="item.isNotification && 'message' in item" class="p-2 border-b last:border-b-0" :class="{ 'bg-muted': !(item as NotificationDropdownItem).read }">
          <div class="flex items-start gap-2">
            <UIcon :name="notificationIcon(item.type)" class="mt-1 flex-shrink-0" :class="notificationIconClass(item.type)" />
            <div class="flex-1">
              <p class="text-sm">{{ (item as NotificationDropdownItem).message }}</p>
              <p class="text-xs text-muted mt-1">{{ formatDate((item as NotificationDropdownItem).createdAt) }}</p>
            </div>
            <UButton
              v-if="!(item as NotificationDropdownItem).read"
              color="neutral"
              variant="ghost"
              icon="i-heroicons-check"
              size="xs"
              @click="markAsRead((item as NotificationDropdownItem).id)"
            />
          </div>
        </div>
        <div v-else-if="!item.isNotification && item.key === 'mark-all'">
          <UButton
            block
            color="neutral"
            variant="ghost"
            :disabled="item.disabled"
            @click="markAllAsRead"
          >
            {{ (item as ActionDropdownItem).label }}
          </UButton>
        </div>
        <div v-else-if="!item.isNotification && item.key === 'empty-placeholder'" class="p-2 text-center text-muted text-sm">
          {{ (item as ActionDropdownItem).message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref, onUnmounted } from 'vue'
import { useNotificationStore } from '~/stores/useNotificationStore'
import { useAuth } from '~/composables/useAuth'
import { format, formatDistance } from 'date-fns'
import { ru } from 'date-fns/locale/ru'

// Define a base type for notification store items
interface BaseNotificationItem {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  createdAt: string
  read: boolean
  metadata?: any
}

// Define specific item types for the dropdown
interface NotificationDropdownItem extends BaseNotificationItem {
  isNotification: true
  userId: string // Assuming this comes from your store
  disabled?: boolean
}

interface ActionDropdownItem {
  key: 'mark-all' | 'empty-placeholder' // Added a key for the empty state for consistency
  isNotification: false
  label?: string // For button text or empty message
  message?: string // For empty state message
  disabled?: boolean
  type?: 'info' // For styling the empty placeholder
  createdAt?: string // For empty placeholder if needed
}

type DropdownItem = NotificationDropdownItem | ActionDropdownItem

const notificationStore = useNotificationStore()
const { user } = useAuth()
const showDropdown = ref(false)

// Toggle dropdown visibility
function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

// Close dropdown when clicking outside
function closeDropdown(e: MouseEvent) {
  if (showDropdown.value) {
    showDropdown.value = false
  }
}

// Setup event listeners
onMounted(() => {
  document.addEventListener('click', closeDropdown)
  if (user.value?.id) {
    notificationStore.fetchNotifications(user.value.id)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

watch(() => user.value?.id, async (newVal) => {
  if (newVal) {
    await notificationStore.fetchNotifications(newVal)
  }
})

// Геттеры из хранилища
const unreadCount = computed(() => notificationStore.unreadCount)
const hasUnread = computed(() => notificationStore.hasUnread)

// Формируем элементы выпадающего меню
const dropdownItems = computed((): DropdownItem[] => {
  const items: DropdownItem[] = notificationStore.notifications.map(notification => ({
    ...(notification as BaseNotificationItem), // Cast to base, specific fields added below
    isNotification: true,
    userId: notification.userId, // Ensure this exists on your store notifications
    disabled: false
  }))
  
  // Добавляем кнопку "Отметить все как прочитанные"
  items.push({
    key: 'mark-all',
    isNotification: false,
    label: 'Отметить все как прочитанные', // Add label for UButton
    disabled: !hasUnread.value
  })
  
  // Если нет уведомлений, показываем сообщение
  if (notificationStore.notifications.length === 0) { // Check actual notifications count
    items.unshift({
      key: 'empty-placeholder', // Use the new key
      isNotification: false, // Treat as an action/placeholder item
      message: 'У вас нет уведомлений',
      type: 'info',
      createdAt: new Date().toISOString(),
      disabled: true
    })
  }
  
  return items
})

// Функции для отметки уведомлений как прочитанные
function markAsRead(id: string) {
  notificationStore.markAsRead(id)
}

function markAllAsRead() {
  if (user.value?.id) {
    notificationStore.markAllAsRead(user.value.id)
  }
}

// Вспомогательные функции
function formatDate(dateString: string) {
  const date = new Date(dateString)
  // Если менее 24 часов, показываем относительное время ("5 часов назад")
  if (Date.now() - date.getTime() < 24 * 60 * 60 * 1000) {
    return formatDistance(date, new Date(), { addSuffix: true, locale: ru })
  }
  // Иначе показываем дату полностью
  return format(date, 'PPp', { locale: ru })
}

function notificationIcon(type: string) {
  switch (type) {
    case 'success': return 'i-heroicons-check-circle'
    case 'warning': return 'i-heroicons-exclamation-triangle'
    case 'error': return 'i-heroicons-x-circle'
    default: return 'i-heroicons-information-circle'
  }
}

function notificationIconClass(type: string) {
  switch (type) {
    case 'success': return 'text-success'
    case 'warning': return 'text-warning'
    case 'error': return 'text-error'
    default: return 'text-info'
  }
}
</script> 