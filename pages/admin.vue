<template>
  <div class="min-h-screen  p-4">
    <!-- Проверка прав доступа -->
    <div v-if="!isAdmin" class="flex items-center justify-center min-h-screen">
      <UCard class="w-full max-w-md">
        <template #header>
          <h1 class="text-xl font-bold text-center text-red-600">🚫 Доступ запрещен</h1>
        </template>
        <div class="text-center space-y-4">
          <p>У вас нет прав доступа к админ панели</p>
          <p class="text-sm text-gray-600">
            Ваша роль: {{ profile?.role || 'не указана' }}
          </p>
          <UButton to="/telegram-auth" color="primary">
            ← Вернуться
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Админ панель -->
    <div v-else class="container mx-auto max-w-6xl">
      <div class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900">⚙️ Админ панель</h1>
        <p class="text-gray-600 mt-2">Управление пользователями и системой</p>
      </div>

      <!-- Быстрые действия -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <UCard>
          <template #header>
            <h3 class="font-medium">🗑️ Очистка данных</h3>
          </template>
          <div class="space-y-3">
            <UButton @click="cleanOldUsers" :loading="cleaningUsers" color="warning" block>
              Удалить пользователей без telegram_id
            </UButton>
            <UButton @click="cleanOldSessions" :loading="cleaningSessions" color="warning" block>
              Очистить старые сессии
            </UButton>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="font-medium">📊 Статистика</h3>
          </template>
          <div class="space-y-2 text-sm">
            <p><strong>Всего пользователей:</strong> {{ stats.totalUsers }}</p>
            <p><strong>Telegram пользователей:</strong> {{ stats.telegramUsers }}</p>
            <p><strong>Администраторов:</strong> {{ stats.admins }}</p>
            <p><strong>Агентов:</strong> {{ stats.agents }}</p>
            <p><strong>Менеджеров:</strong> {{ stats.managers }}</p>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="font-medium">🔄 Система</h3>
          </template>
          <div class="space-y-3">
            <UButton @click="refreshStats" :loading="loadingStats" variant="outline" block>
              Обновить статистику
            </UButton>
            <UButton to="/telegram-auth" variant="soft" block>
              ← Назад к приложению
            </UButton>
          </div>
        </UCard>
      </div>

      <!-- Управление пользователями -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">👥 Управление пользователями ({{ filteredUsers.length }})</h3>
            <UButton @click="loadUsers" :loading="loadingUsers" size="sm">
              🔄 Обновить
            </UButton>
          </div>
        </template>

        <!-- Поиск и фильтры -->
        <div class="mb-4 flex gap-4">
          <UInput v-model="searchQuery" placeholder="Поиск по имени, email, telegram_id..."
            icon="i-heroicons-magnifying-glass" class="flex-1" />
          <USelectMenu v-model="roleFilter" :items="roleFilterOptions" placeholder="Фильтр по роли" class="w-48" />
        </div>

        <!-- Таблица пользователей -->
        <div v-if="filteredUsers.length === 0 && !loadingUsers" class="text-center py-8 text-gray-500">
          <p>Пользователи не найдены</p>
          <p class="text-sm mt-2">Попробуйте изменить фильтры или загрузить данные заново</p>
        </div>

        <UTable :data="filteredUsers" :columns="userColumns" :loading="loadingUsers">
          <!-- Слот для отображения роли -->
          <template #role-cell="{ row }">
            <div v-if="editingUserId === row.original.id" class="w-32">
              <USelectMenu v-model="editingUser.role" :items="roleEditOptions"
                @update:model-value="saveUserField(row.original, 'role', $event)" />
            </div>
            <div v-else class="flex items-center gap-2">
              <UBadge :color="getRoleColor(row.original.role)" variant="subtle">
                {{ getRoleLabel(row.original.role) }}
              </UBadge>
              <UButton @click="startEdit(row.original, 'role')" size="xs" variant="ghost" icon="i-heroicons-pencil" />
            </div>
          </template>

          <!-- Слот для действий -->
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-2">
              <UButton @click="deleteUser(row.original.id)" color="error" variant="soft" size="xs"
                icon="i-heroicons-trash">
                Удалить
              </UButton>
            </div>
          </template>
        </UTable>
      </UCard>

      <!-- Назначение менеджеров лодки -->
      <UCard class="mt-8">
        <template #header>
          <h3 class="text-lg font-medium">⛵ Назначение менеджеров лодки</h3>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormField label="Выберите лодку">
              <USelectMenu v-model="selectedBoat" :items="boats" :loading="loadingBoats" placeholder="Выберите лодку"
                class="w-full" />
            </UFormField>

            <UFormField label="Выберите пользователя">
              <USelectMenu v-model="selectedUser" :items="userOptions" :loading="loadingUsers"
                placeholder="Выберите пользователя" class="w-full" />
            </UFormField>
          </div>

          <div class="flex gap-2">
            <UButton @click="assignBoatManager" :loading="assigningManager" :disabled="!selectedBoat || !selectedUser"
              color="primary">
              Назначить менеджером
            </UButton>

            <UButton @click="loadBoatManagers" :loading="loadingManagers" variant="soft">
              Обновить список
            </UButton>
          </div>

          <!-- Список текущих менеджеров -->
          <div v-if="boatManagers.length > 0" class="mt-6">
            <h4 class="font-medium mb-3">Текущие менеджеры:</h4>
            <div class="grid gap-2">
              <div v-for="manager in boatManagers" :key="`${manager.boat_id}-${manager.user_id}`"
                class="flex items-center justify-between p-3  rounded-lg">
                <div>
                  <span class="font-medium">{{ manager.user_name }}</span>
                  <span class="text-gray-500 ml-2">→ {{ manager.boat_name }}</span>
                </div>
                <UButton @click="removeBoatManager(manager.boat_id, manager.user_id)" color="error" variant="soft"
                  size="xs" icon="i-heroicons-trash">
                  Убрать
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '#imports'
import type { TableColumn } from '@nuxt/ui'

// Метаданные страницы
definePageMeta({
  layout: false,
  title: 'Админ панель',
  middleware: 'telegram-auth'
})

const { profile, isAuthenticated } = useTelegramAuth()
const toast = useToast()

// Состояние
const loadingUsers = ref(false)
const loadingStats = ref(false)
const cleaningUsers = ref(false)
const cleaningSessions = ref(false)
const savingUser = ref(false)
const deletingUsers = ref<string[]>([])

// Состояние для менеджеров лодки
const loadingBoats = ref(false)
const loadingManagers = ref(false)
const assigningManager = ref(false)
const boats = ref<{ label: string; value: string }[]>([])
const selectedBoat = ref<{ label: string; value: string } | undefined>(undefined)
const selectedUser = ref<{ label: string; value: string } | undefined>(undefined)
const boatManagers = ref<any[]>([])

const users = ref<User[]>([])
const stats = ref({
  totalUsers: 0,
  telegramUsers: 0,
  admins: 0,
  agents: 0,
  managers: 0
})

const searchQuery = ref('')
const roleFilter = ref('')

// Состояние редактирования
const editingUserId = ref<string | null>(null)
const editingUser = ref({
  role: { label: '', value: '' }
})

// Вычисляемые свойства
const isAdmin = computed(() => {
  return profile.value?.role === 'admin'
})

// Проверяем development режим
const isDevelopment = computed(() => {
  try {
    return process.env.NODE_ENV === 'development'
  } catch {
    return false
  }
})

// Options для фильтра ролей
const roleFilterOptions = [
  'Все роли',
  'Администратор',
  'Агент',
  'Пользователь'
]

// Options для редактирования ролей - нужны объекты с label и value
const roleEditOptions = [
  { label: 'Администратор', value: 'admin' },
  { label: 'Агент', value: 'agent' },
  { label: 'Пользователь', value: 'user' }
]

// Тип пользователя
type User = {
  id: string
  name?: string
  email?: string
  telegram_id?: string
  phone?: string
  role: string
}

// Columns для UTable - правильный формат
const userColumns: TableColumn<User>[] = [
  {
    accessorKey: 'name',
    header: 'Имя'
  },
  {
    accessorKey: 'email',
    header: 'Email'
  },
  {
    accessorKey: 'telegram_id',
    header: 'Telegram ID'
  },
  {
    accessorKey: 'phone',
    header: 'Телефон'
  },
  {
    accessorKey: 'role',
    header: 'Роль'
  },
  {
    accessorKey: 'actions',
    header: 'Действия'
  }
]

const filteredUsers = computed(() => {
  let filtered = users.value

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user =>
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.telegram_id?.toString().includes(query)
    )
  }

  if (roleFilter.value && roleFilter.value !== 'Все роли') {
    // Convert display name to role value
    const roleMap: Record<string, string> = {
      'Администратор': 'admin',
      'Агент': 'agent',
      'Пользователь': 'user'
    }
    const roleValue = roleMap[roleFilter.value]
    if (roleValue) {
      filtered = filtered.filter(user => user.role === roleValue)
    }
  }

  return filtered
})

// Helper функции
const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    'admin': 'Администратор',
    'agent': 'Агент',
    'user': 'Пользователь'
  }
  return labels[role] || role
}

const getRoleColor = (role: string): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
  const colors = {
    'admin': 'error' as const,
    'agent': 'warning' as const,
    'user': 'success' as const
  }
  return colors[role as keyof typeof colors] || 'neutral'
}

// Функции редактирования
const startEdit = (user: any, field: string) => {
  editingUserId.value = user.id
  if (field === 'role') {
    // Найдем соответствующий объект из roleEditOptions
    const roleOption = roleEditOptions.find(opt => opt.value === user.role)
    editingUser.value.role = roleOption || { label: '', value: user.role }
  }
}

const saveUserField = async (user: any, field: string, newValue: any) => {
  try {
    let valueToSave = newValue

    // Если это роль, извлекаем value из объекта
    if (field === 'role' && newValue && typeof newValue === 'object') {
      valueToSave = newValue.value
    }

    const response = await $fetch('/api/admin/update-user', {
      method: 'POST',
      body: {
        id: user.id,
        field,
        value: valueToSave
      }
    })

    if (response.success) {
      // Обновляем локальные данные
      const userIndex = users.value.findIndex(u => u.id === user.id)
      if (userIndex !== -1) {
        // Используем any для обхода типизации при динамическом присвоении
        (users.value[userIndex] as any)[field] = valueToSave
      }

      toast.add({
        title: 'Успешно',
        description: `${field === 'role' ? 'Роль' : 'Поле'} обновлено`,
        color: 'success'
      })
    }
  } catch (error: any) {
    console.error('❌ Ошибка обновления:', error)
    toast.add({
      title: 'Ошибка',
      description: error.data?.message || 'Ошибка обновления',
      color: 'error'
    })
  } finally {
    editingUserId.value = null
  }
}

const loadUsers = async () => {
  try {
    loadingUsers.value = true

    const result = await $fetch('/api/admin/users', {
      method: 'GET'
    }) as any

    if (result.error) throw new Error(result.error)

    users.value = result.data || []

  } catch (error: any) {
    console.error('❌ Ошибка загрузки пользователей:', error)
    useToast().add({
      title: 'Ошибка',
      description: error.message || 'Не удалось загрузить пользователей',
      color: 'error'
    })
  } finally {
    loadingUsers.value = false
  }
}

const refreshStats = async () => {
  try {
    loadingStats.value = true

    const result = await $fetch('/api/admin/stats', {
      method: 'GET'
    }) as any

    if (result.error) throw new Error(result.error)

    stats.value = result.data || stats.value

  } catch (error: any) {
    console.error('❌ Ошибка статистики:', error)
    useToast().add({
      title: 'Ошибка',
      description: error.message || 'Не удалось обновить статистику',
      color: 'error'
    })
  } finally {
    loadingStats.value = false
  }
}

const cleanOldUsers = async () => {
  try {
    cleaningUsers.value = true

    const result = await $fetch('/api/admin/clean-users', {
      method: 'POST'
    }) as any

    if (result.error) throw new Error(result.error)

    useToast().add({
      title: 'Успешно!',
      description: `Удалено ${result.data.deletedCount} старых пользователей`,
      color: 'success'
    })

    await Promise.all([loadUsers(), refreshStats()])

  } catch (error: any) {
    useToast().add({
      title: 'Ошибка',
      description: error.message || 'Не удалось очистить пользователей',
      color: 'error'
    })
  } finally {
    cleaningUsers.value = false
  }
}

const cleanOldSessions = async () => {
  try {
    cleaningSessions.value = true

    const result = await $fetch('/api/admin/clean-sessions', {
      method: 'POST'
    }) as any

    if (result.error) throw new Error(result.error)

    useToast().add({
      title: 'Успешно!',
      description: `Очищено ${result.data.deletedCount} старых сессий`,
      color: 'success'
    })

  } catch (error: any) {
    useToast().add({
      title: 'Ошибка',
      description: error.message || 'Не удалось очистить сессии',
      color: 'error'
    })
  } finally {
    cleaningSessions.value = false
  }
}

const deleteUser = async (userId: string) => {
  if (!confirm(`Удалить пользователя?`)) return

  try {
    deletingUsers.value.push(userId)

    const result = await $fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { id: userId }
    }) as any

    if (result.error) throw new Error(result.error)

    useToast().add({
      title: 'Успешно!',
      description: 'Пользователь удален',
      color: 'success'
    })

    await Promise.all([loadUsers(), refreshStats()])

  } catch (error: any) {
    useToast().add({
      title: 'Ошибка',
      description: error.message || 'Не удалось удалить пользователя',
      color: 'error'
    })
  } finally {
    deletingUsers.value = deletingUsers.value.filter(id => id !== userId)
  }
}

// Опции пользователей для выбора
const userOptions = computed(() => {
  return users.value.map(user => ({
    label: `${user.name || 'Без имени'} (${user.email})`,
    value: user.id
  }))
})

const loadBoats = async () => {
  try {
    loadingBoats.value = true

    const result = await $fetch('/api/admin/boats', {
      method: 'GET'
    }) as any

    if (result.error) throw new Error(result.error)

    boats.value = result.data?.map((boat: any) => ({
      label: boat.name,
      value: boat.id
    })) || []

  } catch (error: any) {
    console.error('❌ Ошибка загрузки лодок:', error)
    toast.add({
      title: 'Ошибка',
      description: error.message || 'Не удалось загрузить лодки',
      color: 'error'
    })
  } finally {
    loadingBoats.value = false
  }
}

const loadBoatManagers = async () => {
  try {
    loadingManagers.value = true

    const result = await $fetch('/api/admin/boat-managers', {
      method: 'GET'
    }) as any

    if (result.error) throw new Error(result.error)

    boatManagers.value = result.data || []

  } catch (error: any) {
    console.error('❌ Ошибка загрузки менеджеров:', error)
    toast.add({
      title: 'Ошибка',
      description: error.message || 'Не удалось загрузить менеджеров',
      color: 'error'
    })
  } finally {
    loadingManagers.value = false
  }
}

const assignBoatManager = async () => {
  if (!selectedBoat.value || !selectedUser.value) return

  try {
    assigningManager.value = true

    const result = await $fetch('/api/admin/assign-boat-manager', {
      method: 'POST',
      body: {
        boat_id: selectedBoat.value.value,
        user_id: selectedUser.value.value
      }
    }) as any

    if (result.error) throw new Error(result.error)

    toast.add({
      title: 'Успешно',
      description: 'Менеджер назначен',
      color: 'success'
    })

    // Очищаем форму и обновляем список
    selectedBoat.value = undefined
    selectedUser.value = undefined
    await loadBoatManagers()

  } catch (error: any) {
    console.error('❌ Ошибка назначения менеджера:', error)
    toast.add({
      title: 'Ошибка',
      description: error.message || 'Не удалось назначить менеджера',
      color: 'error'
    })
  } finally {
    assigningManager.value = false
  }
}

const removeBoatManager = async (boatId: string, userId: string) => {
  if (!confirm('Убрать пользователя из менеджеров лодки?')) return

  try {
    const result = await $fetch('/api/admin/remove-boat-manager', {
      method: 'POST',
      body: {
        boat_id: boatId,
        user_id: userId
      }
    }) as any

    if (result.error) throw new Error(result.error)

    toast.add({
      title: 'Успешно',
      description: 'Менеджер убран',
      color: 'success'
    })

    await loadBoatManagers()

  } catch (error: any) {
    console.error('❌ Ошибка удаления менеджера:', error)
    toast.add({
      title: 'Ошибка',
      description: error.message || 'Не удалось убрать менеджера',
      color: 'error'
    })
  }
}

// Инициализация
onMounted(async () => {
  if (isAdmin.value) {
    await Promise.all([
      loadUsers(),
      refreshStats(),
      loadBoats(),
      loadBoatManagers()
    ])
  }
})
</script>
