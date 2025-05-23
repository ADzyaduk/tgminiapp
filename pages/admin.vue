<template>
  <div>
    <UContainer class="py-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold">Панель администратора</h1>
          <p class="mt-1 text-sm text-gray-500">Управление пользователями и менеджерами лодок</p>
        </div>
        
        <UButton
          to="/"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-home"
        >
          На главную
        </UButton>
      </div>
      
      <!-- Loader -->
      <div v-if="isLoading" class="py-32 flex flex-col items-center justify-center">
        <UProgress animation="carousel" class="w-32" />
        <p class="mt-4 text-gray-500">Загрузка панели администратора...</p>
      </div>
      
      <!-- Access Denied -->
      <UCard v-else-if="!isAdmin" class="max-w-md mx-auto">
        <div class="text-center py-6">
          <UIcon name="i-heroicons-lock-closed" class="mx-auto h-12 w-12 text-red-500" />
          <h3 class="mt-2 text-xl font-bold">Доступ запрещен</h3>
          <p class="mt-1 text-gray-500">У вас нет прав администратора для доступа к этой странице</p>
          
          <UButton
            class="mt-6"
            to="/"
            color="primary"
            block
          >
            Вернуться на главную
          </UButton>
        </div>
      </UCard>
      
      <!-- Admin Panel -->
      <div v-else>
        <UTabs v-model="activeTabValue" :items="tabItems" class="mb-6">
          <template #content="{ item }">
            <!-- Users Tab -->
            <div v-if="item.value === 'users'" class="space-y-6">
              <!-- User List -->
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h2 class="text-xl font-semibold">Список пользователей</h2>
                    <UButton
                      @click="loadUsers"
                      variant="soft"
                      color="primary"
                      icon="i-heroicons-arrow-path"
                      :loading="isLoadingUsers"
                    >
                      Обновить
                    </UButton>
                  </div>
                </template>

                <div class="p-4">
                  <UInput
                    v-model="userSearchQuery"
                    icon="i-heroicons-magnifying-glass"
                    placeholder="Поиск по имени или email"
                    class="mb-4"
                  />

                  <div class="space-y-4">
                    <div v-for="user in filteredUsers" :key="user.id" class="border rounded-lg p-4">
                      <div class="flex items-center justify-between">
                        <div>
                          <p class="font-semibold">{{ user.name || 'Без имени' }}</p>
                          <p class="text-sm text-gray-600">{{ user.email }}</p>
                        </div>
                        <div class="flex items-center gap-2">
                          <USelect
                            v-model="user.role"
                            :items="roleOptions"
                            placeholder="Выберите роль"
                            @update:model-value="updateUserRole(user)"
                            :loading="isRoleUpdating && updatingUserId === user.id"
                            class="w-40"
                          />
                          <UButton
                            @click="confirmDeleteUser(user)"
                            color="error"
                            variant="soft"
                            icon="i-heroicons-trash"
                            size="sm"
                          >
                            Удалить
                          </UButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>

            <!-- Boat Managers Tab -->
            <div v-else-if="item.value === 'managers'" class="space-y-6">
              <!-- Boat Selection -->
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h2 class="text-xl font-semibold">Управление менеджерами лодок</h2>
                    <UButton
                      @click="loadBoats"
                      variant="soft"
                      color="primary"
                      icon="i-heroicons-arrow-path"
                      :loading="isLoadingBoats"
                    >
                      Обновить
                    </UButton>
                  </div>
                </template>

                <div class="p-4">
                  <label class="block text-sm font-medium text-gray-700 mb-2">Выберите лодку:</label>
                  <USelect 
                    v-model="selectedBoat" 
                    :items="formattedBoats"
                    value-key="value"
                    placeholder="Выберите лодку"
                    class="block w-full mb-4"
                  />

                  <!-- Current Managers -->
                  <div v-if="selectedBoat" class="space-y-4">
                    <h3 class="font-semibold">Текущие менеджеры</h3>
                    <div v-if="currentManagers.length" class="space-y-2">
                      <div v-for="manager in currentManagers" :key="manager.id" class="flex items-center justify-between p-2 rounded">
                        <div>
                          <p class="font-medium">{{ manager.name }}</p>
                          <p class="text-sm text-gray-600">{{ manager.email }}</p>
                        </div>
                        <UButton
                          @click="removeManager(manager.id)"
                          color="error"
                          variant="soft"
                          icon="i-heroicons-trash"
                          size="sm"
                        >
                          Удалить
                        </UButton>
                      </div>
                    </div>
                    <p v-else class="text-gray-500">Нет назначенных менеджеров</p>

                    <!-- Add New Manager -->
                    <div class="mt-4">
                      <h3 class="font-semibold mb-2">Добавить менеджера</h3>
                      <USelect
                        v-model="selectedUser"
                        :items="formattedAvailableUsers"
                        value-key="value"
                        placeholder="Выберите пользователя"
                        class="block w-full mb-4"
                      />
                      <UButton
                        @click="addManager"
                        color="primary"
                        :disabled="!selectedUser"
                        :loading="isAddingManager"
                      >
                        Назначить менеджером
                      </UButton>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>
          </template>
        </UTabs>
      </div>
    </UContainer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast, useSupabaseClient } from '#imports'
import { useAuth } from '~/composables/useAuth'

// Защита страницы - требуется авторизация
definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

const supabase = useSupabaseClient()
const toast = useToast()
const { user: authUser, isAdmin: authIsAdmin, loading: authLoading } = useAuth()

// State
const isLoading = ref(true)
const isLoadingUsers = ref(false)
const isLoadingBoats = ref(false)
const isAdmin = ref(false)
const isAddingManager = ref(false)
const isRoleUpdating = ref(false)
const updatingUserId = ref<string | null>(null)
const userSearchQuery = ref('')
const selectedBoat = ref<string | undefined>(undefined)
const selectedUser = ref<string | undefined>(undefined)
const activeTabValue = ref('users')

// Data
interface Boat {
  id: string;
  name: string;
}

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

const users = ref<User[]>([])
const boats = ref<Boat[]>([])
const currentManagers = ref<User[]>([])

// Options
const roleOptions = [
  { label: 'Пользователь', value: 'user' },
  { label: 'Агент', value: 'agent' },
  { label: 'Администратор', value: 'admin' }
]

const tabs = [
  {
    label: 'Пользователи',
    slot: 'users',
    icon: 'i-heroicons-users'
  },
  {
    label: 'Менеджеры лодок',
    slot: 'managers',
    icon: 'i-heroicons-cube'
  }
]

// Преобразуем tabs для UTabs компонента
const tabItems = computed(() => 
  tabs.map(tab => ({
    label: tab.label,
    icon: tab.icon,
    value: tab.slot
  }))
)

// Computed
const filteredUsers = computed(() => {
  if (!userSearchQuery.value) return users.value
  const query = userSearchQuery.value.toLowerCase()
  return users.value.filter(user => 
    (user.name?.toLowerCase().includes(query)) ||
    (user.email?.toLowerCase().includes(query))
  )
})

const formattedBoats = computed(() => {
  return boats.value.map(boat => ({
    label: boat.name,
    value: boat.id
  }))
})

const formattedAvailableUsers = computed(() => {
  return availableUsers.value.map(user => ({
    label: user.name || user.email,
    value: user.id
  }));
});

const availableUsers = computed(() => {
  // Возвращаем всех пользователей, которые еще не назначены менеджерами текущей лодки
  return users.value.filter(user => {
    // Если нет менеджеров еще, показываем всех пользователей
    if (!currentManagers.value.length) return true;
    
    // Проверяем, что пользователь не является уже менеджером
    return !currentManagers.value.some(manager => manager.id === user.id);
  });
})

// Methods
const checkAdminAccess = async () => {
  try {
    const { data: { user } }: { data: { user: any } } = await supabase.auth.getUser()
    
    if (!user) {
      // Если пользователь не авторизован, редиректим на логин
      await navigateTo('/login')
      return
    }

    const { data: profile, error: profileError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      throw profileError
    }
    
    isAdmin.value = profile?.role === 'admin'
  } catch (error: any) {
    // Если ошибка связана с авторизацией, редиректим на логин
    if (error.message === 'Не авторизован' || error.message?.includes('auth')) {
      await navigateTo('/login')
      return
    }
    
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось проверить права доступа',
      color: 'error'
    })
  }
}

const loadUsers = async () => {
  isLoadingUsers.value = true
  try {
    const { data, error }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .order('name')

    if (error) throw error
    users.value = data
  } catch (error: any) {
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список пользователей',
      color: 'error'
    })
  } finally {
    isLoadingUsers.value = false
  }
}

const loadBoats = async () => {
  isLoadingBoats.value = true
  try {
    const { data, error }: { data: any, error: any } = await supabase
      .from('boats')
      .select('id, name')
      .order('name')

    if (error) throw error
    
    boats.value = data || []
  } catch (error: any) {
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список лодок',
      color: 'error'
    })
  } finally {
    isLoadingBoats.value = false
  }
}

const loadCurrentManagers = async () => {
  if (!selectedBoat.value) {
    currentManagers.value = []
    return
  }

  try {
    // НЕ преобразуем в число - UUID должен остаться строкой
    const boatId = selectedBoat.value
    
    const { data, error }: { data: any, error: any } = await supabase
      .from('boat_managers')
      .select(`
        user_id,
        profiles:user_id (id, name, email)
      `)
      .eq('boat_id', boatId)

    if (error) throw error
    
    currentManagers.value = data.map((item: any) => item.profiles)
  } catch (error: any) {
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список менеджеров',
      color: 'error'
    })
  }
}

const updateUserRole = async (user: User) => {
  if (isRoleUpdating.value && updatingUserId.value === user.id) return

  isRoleUpdating.value = true
  updatingUserId.value = user.id
  try {
    // Получаем текущего пользователя для проверки
    const { data: { user: currentUser } }: { data: { user: any } } = await supabase.auth.getUser()
    
    // Проверим, имеем ли мы доступ к профилю пользователя
    const { data: userProfile, error: profileError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()
      
    if (profileError) {
      console.error('Error getting user profile:', profileError)
    }
    
    // Пробуем обновить профиль
    let updateResult
    
    try {
      // Сначала пробуем использовать RPC вызов (хранимую процедуру)
      const { data: rpcData, error: rpcError }: { data: any, error: any } = await supabase
        .rpc('update_user_role', {
          p_user_id: user.id,
          p_role: user.role
        })
        
      if (rpcError) {
        throw rpcError
      }
      
      updateResult = rpcData
    } catch (rpcErr) {
      // Если RPC не работает, попробуем прямое обновление
      const { data: directUpdate, error: directError }: { data: any, error: any } = await supabase
        .from('profiles')
        .update({ role: user.role })
        .eq('id', user.id)
        .select()
        
      if (directError) {
        throw directError
      }
      
      updateResult = directUpdate
    }

    // Полностью обновляем список пользователей, чтобы убедиться, что UI отражает актуальные данные
    await loadUsers()
    
    toast.add({
      title: 'Успешно',
      description: 'Роль пользователя обновлена',
      color: 'success'
    })
  } catch (error: any) {
    // Восстанавливаем предыдущую роль в UI в случае ошибки
    // Это будет обработано при перезагрузке списка через loadUsers()
    await loadUsers()
    
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось обновить роль пользователя: ' + (error.message || 'Неизвестная ошибка'),
      color: 'error'
    })
  } finally {
    isRoleUpdating.value = false
    updatingUserId.value = null
  }
}

const addManager = async () => {
  if (!selectedBoat.value || !selectedUser.value) {
    return;
  }

  isAddingManager.value = true
  try {
    // НЕ преобразуем в число - UUID должен остаться строкой
    const boatId = selectedBoat.value
    
    const { error }: { error: any } = await supabase
      .from('boat_managers')
      .insert([{
        boat_id: boatId,
        user_id: selectedUser.value
      }])

    if (error) throw error

    await loadCurrentManagers()
    selectedUser.value = undefined

    toast.add({
      title: 'Успешно',
      description: 'Менеджер назначен',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось назначить менеджера',
      color: 'error'
    })
  } finally {
    isAddingManager.value = false
  }
}

const removeManager = async (userId: string) => {
  if (!selectedBoat.value) return
  try {
    // НЕ преобразуем в число - UUID должен остаться строкой
    const boatId = selectedBoat.value
    
    const { error }: { error: any } = await supabase
      .from('boat_managers')
      .delete()
      .eq('boat_id', boatId)
      .eq('user_id', userId)

    if (error) throw error

    await loadCurrentManagers()

    toast.add({
      title: 'Успешно',
      description: 'Менеджер удален',
      color: 'success'
    })
  } catch (error: any) {
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось удалить менеджера',
      color: 'error'
    })
  }
}

const confirmDeleteUser = (user: User) => {
  if (confirm(`Вы уверены, что хотите удалить пользователя ${user.name || user.email}? Это действие также удалит его из всех менеджеров лодок.`)) {
    deleteUser(user.id as string)
  }
}

const deleteUser = async (userId: string) => {
  try {
    // Получаем текущего пользователя для проверки
    const { data: { user: currentUser } }: { data: { user: any } } = await supabase.auth.getUser()
    
    // Проверим, имеем ли мы доступ к профилю пользователя
    const { data: userProfile, error: profileError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, role, name, email')
      .eq('id', userId)
      .single()
      
    if (profileError) {
      console.error('Error getting user profile:', profileError)
    }
    
    let deleteSuccess = false;
    
    // 1. Remove from boat_managers
    const { error: boatManagerError }: { error: any } = await supabase
      .from('boat_managers')
      .delete()
      .eq('user_id', userId)

    if (boatManagerError) {
      console.error('Error deleting from boat_managers:', boatManagerError);
      // Не выбрасываем ошибку, продолжаем попытку удаления профиля
    }

    // 2. Remove from profiles
    const { error: profileDeleteError }: { error: any } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('Error deleting from profiles:', profileDeleteError);
      throw profileDeleteError;
    } else {
      deleteSuccess = true;
    }

    if (deleteSuccess) {
      toast.add({
        title: 'Успешно',
        description: 'Пользователь удален',
        color: 'success'
      })

      await loadUsers() // Refresh user list
    } else {
      throw new Error('Не удалось удалить пользователя');
    }

  } catch (error: any) {
    toast.add({
      title: 'Ошибка',
      description: `Не удалось удалить пользователя: ${error.message || 'Неизвестная ошибка'}`,
      color: 'error'
    })
  }
}

// Изменяем обработчик выбора лодки
watch(selectedBoat, (newValue) => {
  if (newValue) {
    // Убеждаемся, что значение не пустое
    if (newValue === '') {
      currentManagers.value = []
      return
    }
    
    // Загружаем менеджеров для выбранной лодки
    loadCurrentManagers()
  } else {
    currentManagers.value = []
  }
})

// Initialize
onMounted(async () => {
  // Ждем завершения загрузки auth
  let attempts = 0
  while (authLoading.value && attempts < 20) {
    await new Promise(resolve => setTimeout(resolve, 100))
    attempts++
  }
  
  // Если после ожидания пользователь все еще не загружен, проверяем вручную
  if (!authUser.value) {
    await checkAdminAccess()
    
    // Если функция checkAdminAccess сделала редирект, выходим
    if (!authUser.value && !isAdmin.value) {
      isLoading.value = false
      return
    }
  }
  
  // Используем значение из useAuth как приоритетное
  if (authIsAdmin.value) {
    isAdmin.value = true
  }
  
  if (isAdmin.value || authIsAdmin.value) {
    await Promise.all([loadUsers(), loadBoats()])
  }
  
  isLoading.value = false
})
</script>


