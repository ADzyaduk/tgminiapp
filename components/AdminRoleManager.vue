<template>
  <div class="admin-role-manager">
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Управление ролями пользователей</h2>
          <UBadge color="info" variant="soft">Глобальные роли</UBadge>
        </div>
      </template>
      
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-8">
        <UProgress animation="carousel" />
      </div>
      
      <!-- Main content -->
      <div v-else>
        <!-- Отладочная информация -->
        <div class="mb-4 p-3 bg-gray-100 rounded-md text-sm">
          <p class="font-medium">Отладочная информация:</p>
          <div class="mt-2 text-xs">
            <p>Загруженные пользователи: {{ users.length }}</p>
            <p>Отфильтрованные пользователи: {{ filteredUsers.length }}</p>
            <p>Выбранный фильтр: {{ selectedRoleFilter }}</p>
          </div>
        </div>
        
        <!-- Role filter -->
        <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
          <UBadge 
            v-for="role in roleFilters" 
            :key="role.value"
            :color="role.value === selectedRoleFilter ? 'primary' : 'secondary'"
            variant="soft"
            size="lg"
            class="cursor-pointer"
            @click="selectedRoleFilter = role.value"
          >
            {{ role.label }} ({{ getRoleCount(role.value) }})
          </UBadge>
        </div>
        
        <!-- Search -->
        <div class="mb-6">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="Поиск по имени или email"
            trailing
            @input="debouncedSearch"
          >
            <template #trailing>
              <UButton
                v-if="searchQuery"
                icon="i-heroicons-x-mark"
                color="primary"
                variant="ghost"
                @click="clearSearch"
              />
            </template>
          </UInput>
        </div>
        
        <!-- Users list -->
        <div v-if="filteredUsers.length" class="space-y-4">
          <TransitionGroup name="list">
            <UCard
              v-for="user in filteredUsers"
              :key="user.id"
              class="border-l-4"
              :class="getRoleBorderClass(user.role)"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3">
                    <UAvatar 
                      :text="getUserInitials(user)"
                      :ui="{
                        text: 'text-white font-medium'
                      }"
                      :class="getRoleAvatarClass(user.role)"
                    />
                    <div>
                      <h3 class="font-medium">{{ user.name || 'Без имени' }}</h3>
                      <p class="text-sm text-gray-500">{{ user.email }}</p>
                      <div class="flex items-center mt-1">
                        <UBadge
                          :color="getRoleBadgeColor(user.role)"
                          variant="soft"
                          size="xs"
                        >
                          {{ getRoleLabel(user.role) }}
                        </UBadge>
                        <p v-if="user.phone" class="ml-2 text-xs text-gray-500">{{ user.phone }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 self-end md:self-center">
                  <UPopover v-if="canChangeUserRole(user)">
                    <UButton
                      color="primary"
                      variant="soft"
                      icon="i-heroicons-pencil-square"
                    >
                      Изменить роль
                    </UButton>
                    
                    <template #panel>
                      <div class="p-4 w-60">
                        <p class="text-sm font-medium mb-3">Выберите роль для пользователя</p>
                        <div class="space-y-2">
                          <URadio 
                            v-for="role in availableRoles" 
                            :key="role.value"
                            v-model="selectedRole"
                            :value="role.value"
                            :label="role.label"
                          />
                          
                          <div class="pt-4 flex justify-end gap-2">
                            <UButton 
                              size="sm"
                              variant="ghost" 
                              @click="selectedRole = user.role"
                            >
                              Отмена
                            </UButton>
                            <UButton 
                              size="sm"
                              color="primary" 
                              @click="updateUserRole(user)"
                              :loading="updatingUser === user.id"
                            >
                              Сохранить
                            </UButton>
                          </div>
                        </div>
                      </div>
                    </template>
                  </UPopover>
                  
                  <UTooltip v-else text="Нельзя изменить роль текущего пользователя">
                    <UButton
                      color="secondary"
                      variant="ghost"
                      icon="i-heroicons-lock-closed"
                      disabled
                    >
                      Изменить роль
                    </UButton>
                  </UTooltip>
                </div>
              </div>
            </UCard>
          </TransitionGroup>
        </div>
        
        <div v-else class="text-center py-10">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-lg font-medium text-gray-900">Нет пользователей</h3>
          <p class="mt-1 text-sm text-gray-500">
            {{ searchQuery ? 'Попробуйте изменить параметры поиска' : 'Пользователи не найдены' }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import debounce from 'lodash/debounce'

const supabase = useNuxtApp().$supabase
const toast = useToast()

// Типы
interface User {
  id: string
  email: string
  name?: string
  phone?: string
  role?: string
}

interface RoleOption {
  value: string
  label: string
}

// State
const users = ref<User[]>([])
const loading = ref(true)
const searchQuery = ref('')
const selectedRoleFilter = ref('all')
const currentUserId = ref('')
const selectedRole = ref('')
const updatingUser = ref('')

// Role configuration
const availableRoles: RoleOption[] = [
  { value: 'user', label: 'Пользователь' },
  { value: 'agent', label: 'Агент' },
  { value: 'admin', label: 'Администратор' }
]

const roleFilters: RoleOption[] = [
  { value: 'all', label: 'Все пользователи' },
  { value: 'user', label: 'Пользователи' },
  { value: 'agent', label: 'Агенты' },
  { value: 'admin', label: 'Администраторы' }
]

// Подсчет пользователей по ролям
const getRoleCount = (role: string): number => {
  if (role === 'all') return users.value.length
  
  return users.value.filter(user => user.role === role).length
}

// Filtered users
const filteredUsers = computed(() => {
  let filtered = [...users.value]
  
  // Filter by role
  if (selectedRoleFilter.value !== 'all') {
    filtered = filtered.filter(user => user.role === selectedRoleFilter.value)
  }
  
  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(user => 
      (user.name && user.name.toLowerCase().includes(query)) ||
      (user.email && user.email.toLowerCase().includes(query))
    )
  }
  
  return filtered
})

// Helper methods
const getUserInitials = (user: User): string => {
  if (!user.name) return user.email.charAt(0).toUpperCase()
  
  const nameParts = user.name.split(' ')
  if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase()
  
  return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
}

const getRoleLabel = (role?: string): string => {
  const found = availableRoles.find(r => r.value === role)
  return found ? found.label : 'Пользователь'
}

const getRoleBadgeColor = (role?: string): "primary" | "secondary" | "info" | "success" | "warning" | "error" | "neutral" => {
  switch (role) {
    case 'admin': return 'error'
    case 'agent': return 'info'
    default: return 'secondary'
  }
}

const getRoleAvatarClass = (role?: string): string => {
  return ''; // Используем стандартный фон вместо цветного
}

const getRoleBorderClass = (role?: string): string => {
  switch (role) {
    case 'admin': return 'border-red-500'
    case 'agent': return 'border-blue-500'
    default: return 'border-gray-200'
  }
}

const roleBackgroundClass = (role) => {
  return '' // Используем стандартный фон
}

// Check if we can change user role
const canChangeUserRole = (user: User): boolean => {
  return user.id !== currentUserId.value
}

// Data fetching
const fetchUsers = async () => {
  try {
    loading.value = true
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    currentUserId.value = user?.id || ''
    
    // Get all users
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, phone, role')
      .order('email')
      
    if (error) throw error
    users.value = data || []
  } catch (error) {
    console.error('Error fetching users:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список пользователей',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Update user role
const updateUserRole = async (user: User) => {
  if (selectedRole.value === user.role) return
  
  try {
    updatingUser.value = user.id
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: selectedRole.value })
      .eq('id', user.id)
      
    if (error) throw error
    
    // Update local state
    const index = users.value.findIndex(u => u.id === user.id)
    if (index !== -1) {
      users.value[index].role = selectedRole.value
    }
    
    toast.add({
      title: 'Успешно',
      description: `Роль пользователя изменена на "${getRoleLabel(selectedRole.value)}"`,
      color: 'success'
    })
  } catch (error) {
    console.error('Error updating user role:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось обновить роль пользователя',
      color: 'error'
    })
  } finally {
    updatingUser.value = ''
  }
}

// Search
const debouncedSearch = debounce(() => {
  // The computed filteredUsers will update automatically
}, 300)

const clearSearch = () => {
  searchQuery.value = ''
}

// Watch for user selection to set default role
watch(users, (newUsers) => {
  if (newUsers.length && !selectedRole.value) {
    selectedRole.value = 'user'
  }
})

// Initialize
onMounted(fetchUsers)
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style> 