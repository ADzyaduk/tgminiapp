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

const supabase = useSupabaseClient()
const toast = useToast()

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
    if (!user) throw new Error('Не авторизован')

    const { data: profile }: { data: any } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    isAdmin.value = profile?.role === 'admin'
  } catch (error: any) {
    console.error('Ошибка проверки прав:', error)
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
    console.error('Ошибка загрузки пользователей:', error)
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
    
    console.log('Loaded boats data:', data)
    
    // Просто используем данные как есть
    boats.value = data || []
  } catch (error: any) {
    console.error('Ошибка загрузки лодок:', error)
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
    
    console.log('Loading managers for boat ID:', boatId)
    
    const { data, error }: { data: any, error: any } = await supabase
      .from('boat_managers')
      .select(`
        user_id,
        profiles:user_id (id, name, email)
      `)
      .eq('boat_id', boatId)

    if (error) throw error
    
    console.log('Loaded managers data:', data)
    currentManagers.value = data.map((item: any) => item.profiles)
  } catch (error: any) {
    console.error('Ошибка загрузки менеджеров:', error)
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
    console.log('Начинаем обновление роли пользователя:', { 
      id: user.id, 
      role: user.role,
      name: user.name,
      email: user.email
    })
    
    // Получаем текущего пользователя для проверки
    const { data: { user: currentUser } }: { data: { user: any } } = await supabase.auth.getUser()
    console.log('Текущий авторизованный пользователь:', currentUser?.id)
    
    // Проверим, имеем ли мы доступ к профилю пользователя
    const { data: userProfile, error: profileError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()
      
    if (profileError) {
      console.error('Ошибка получения профиля:', profileError)
    } else {
      console.log('Текущий профиль в базе:', userProfile)
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
        console.error('Ошибка RPC вызова:', rpcError)
        throw rpcError
      }
      
      console.log('Результат RPC вызова:', rpcData)
      updateResult = rpcData
    } catch (rpcErr) {
      // Если RPC не работает, попробуем прямое обновление
      const { data: directUpdate, error: directError }: { data: any, error: any } = await supabase
        .from('profiles')
        .update({ role: user.role })
        .eq('id', user.id)
        .select()
        
      if (directError) {
        console.error('Ошибка прямого обновления:', directError)
        throw directError
      }
      
      console.log('Результат прямого обновления:', directUpdate)
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
    console.error('Ошибка обновления роли:', error)
    
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
    console.log('Не выбрана лодка или пользователь:', {
      selectedBoat: selectedBoat.value,
      selectedUser: selectedUser.value
    });
    return;
  }

  isAddingManager.value = true
  try {
    // НЕ преобразуем в число - UUID должен остаться строкой
    const boatId = selectedBoat.value
    
    console.log('Adding manager:', { 
      boat_id: boatId, 
      user_id: selectedUser.value,
      availableUsers: availableUsers.value.map(u => ({ id: u.id, name: u.name }))
    })
    
    const { error }: { error: any } = await supabase
      .from('boat_managers')
      .insert([{
        boat_id: boatId,
        user_id: selectedUser.value
      }])

    if (error) throw error

    console.log('Менеджер успешно добавлен, обновляем список');
    await loadCurrentManagers()
    selectedUser.value = undefined

    toast.add({
      title: 'Успешно',
      description: 'Менеджер назначен',
      color: 'success'
    })
  } catch (error: any) {
    console.error('Ошибка назначения менеджера:', error)
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
    
    console.log('Removing manager:', { 
      boat_id: boatId, 
      user_id: userId 
    })
    
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
    console.error('Ошибка удаления менеджера:', error)
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
    console.log('Начинаем удаление пользователя:', userId);
    
    // Получаем текущего пользователя для проверки
    const { data: { user: currentUser } }: { data: { user: any } } = await supabase.auth.getUser()
    console.log('Текущий авторизованный пользователь:', currentUser?.id)
    
    // Проверим, имеем ли мы доступ к профилю пользователя
    const { data: userProfile, error: profileError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, role, name, email')
      .eq('id', userId)
      .single()
      
    if (profileError) {
      console.error('Ошибка получения профиля:', profileError)
    } else {
      console.log('Профиль для удаления:', userProfile)
    }
    
    let deleteSuccess = false;
    
    // 1. Remove from boat_managers
    console.log('Удаление из boat_managers...');
    const { error: boatManagerError }: { error: any } = await supabase
      .from('boat_managers')
      .delete()
      .eq('user_id', userId)

    if (boatManagerError) {
      console.error('Ошибка удаления из boat_managers:', boatManagerError);
      // Не выбрасываем ошибку, продолжаем попытку удаления профиля
    } else {
      console.log('Успешно удалено из boat_managers');
    }

    // 2. Remove from profiles
    console.log('Удаление из profiles...');
    const { error: profileDeleteError }: { error: any } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('Ошибка удаления из profiles:', profileDeleteError);
      throw profileDeleteError;
    } else {
      console.log('Успешно удалено из profiles');
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
    console.error('Ошибка удаления пользователя:', error)
    toast.add({
      title: 'Ошибка',
      description: `Не удалось удалить пользователя: ${error.message || 'Неизвестная ошибка'}`,
      color: 'error'
    })
  }
}

// Вспомогательные методы
const checkPermissions = async () => {
  try {
    // Получаем текущего пользователя
    const { data: { user } }: { data: { user: any } } = await supabase.auth.getUser()
    
    if (!user) {
      console.error('Пользователь не авторизован')
      return
    }
    
    console.log('Проверка разрешений для пользователя:', user.id)
    
    // Проверяем доступ к таблице profiles
    const { data: profile, error: profileError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()
      
    if (profileError) {
      console.error('Ошибка доступа к своему профилю:', profileError)
    } else {
      console.log('Доступ к своему профилю:', profile)
    }
    
    // Тестовое обновление своего профиля
    const { data: updateResult, error: updateError }: { data: any, error: any } = await supabase
      .from('profiles')
      .update({ role: profile.role }) // Обновляем на то же значение
      .eq('id', user.id)
      .select()
      
    if (updateError) {
      console.error('Ошибка обновления своего профиля:', updateError)
    } else {
      console.log('Обновление своего профиля:', updateResult)
    }
    
    // Проверяем, можем ли мы читать другие профили
    const { data: otherProfiles, error: otherProfilesError }: { data: any, error: any } = await supabase
      .from('profiles')
      .select('id, role')
      .neq('id', user.id)
      .limit(1)
      
    if (otherProfilesError) {
      console.error('Ошибка доступа к другим профилям:', otherProfilesError)
    } else if (otherProfiles.length > 0) {
      console.log('Доступ к другим профилям:', otherProfiles[0])
      
      // Тестовое обновление другого профиля
      const otherUserId = otherProfiles[0].id
      const { data: otherUpdateResult, error: otherUpdateError }: { data: any, error: any } = await supabase
        .from('profiles')
        .update({ role: otherProfiles[0].role }) // Обновляем на то же значение
        .eq('id', otherUserId)
        .select()
        
      if (otherUpdateError) {
        console.error('Ошибка обновления другого профиля:', otherUpdateError)
      } else {
        console.log('Обновление другого профиля:', otherUpdateResult)
      }
    }
  } catch (error: any) {
    console.error('Ошибка проверки разрешений:', error)
  }
}

// Изменяем обработчик выбора лодки
watch(selectedBoat, (newValue) => {
  console.log('Selected boat changed to:', newValue, typeof newValue)
  if (newValue) {
    // Убеждаемся, что значение не пустое
    if (newValue === '') {
      currentManagers.value = []
      return
    }
    
    // Не нужно преобразовывать в число - UUID должен остаться строкой
    console.log('Using boat ID for loading managers:', newValue)
    
    // Загружаем менеджеров для выбранной лодки
    loadCurrentManagers()
  } else {
    currentManagers.value = []
  }
})

// Initialize
onMounted(async () => {
  await checkAdminAccess()
  if (isAdmin.value) {
    await Promise.all([loadUsers(), loadBoats()])
    // Проверяем разрешения после загрузки данных
    await checkPermissions()
  }
  isLoading.value = false
})
</script>


