<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useNuxtApp } from '#imports'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'

// Типы данных
interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: string | null
}

interface Boat {
  id: string
  name: string
}

interface FormattedBoat {
  value: string
  label: string
}

// Инициализация
const router = useRouter()
const nuxtApp = useNuxtApp()
const $supabase = nuxtApp.$supabase as SupabaseClient<Database>
const toast = useToast()

// Состояния
const isLoading = ref(true)
const currentUser = ref<any>(null)
const isAdmin = ref(false)
const boats = ref<FormattedBoat[]>([])
const users = ref<User[]>([])
const selectedBoat = ref<FormattedBoat | undefined>(undefined)
const searchQuery = ref('')
const assigningUser = ref<string | null>(null)

// Вычисляемые свойства
const selectedBoatId = computed(() => selectedBoat.value?.value || '')

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(user => 
    (user.name && user.name.toLowerCase().includes(query)) ||
    (user.email && user.email.toLowerCase().includes(query))
  )
})

// Функции
const checkAdminAccess = async () => {
  try {
    const { data: { user }, error: authError } = await $supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Пользователь не аутентифицирован')
    }
    
    currentUser.value = user
    
    const { data: profile, error: profileError } = await $supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      
    if (profileError) throw profileError
    
    isAdmin.value = profile?.role === 'admin'
    if (!isAdmin.value) {
      router.push('/')
    }
  } catch (error) {
    console.error('Ошибка проверки прав:', error)
    toast.add({
      title: 'Ошибка доступа',
      description: error instanceof Error ? error.message : 'Не удалось проверить права доступа',
      color: 'error'
    })
    router.push('/login')
  }
}

const loadBoats = async () => {
  try {
    const { data, error } = await $supabase
      .from('boats')
      .select('id, name')
      .order('name', { ascending: true })
    
    if (error) throw error
    
    boats.value = (data || []).map(boat => ({
      value: boat.id,
      label: boat.name
    }))
    
    console.log('Загружены лодки:', boats.value)
  } catch (error) {
    console.error('Ошибка загрузки лодок:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список лодок',
      color: 'error'
    })
  }
}

const loadUsers = async () => {
  try {
    const { data, error } = await $supabase
      .from('profiles')
      .select('id, email, name, phone, role')
    
    if (error) throw error
    
    // Фильтруем пользователей, исключая текущего и админов
    users.value = (data || []).filter(user => 
      user.id !== currentUser.value?.id && 
      user.role !== 'admin'
    )
    
    console.log('Загружены пользователи:', users.value)
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список пользователей',
      color: 'error'
    })
  }
}

const assignManager = async (userId: string) => {
  if (!selectedBoatId.value) {
    toast.add({
      title: 'Ошибка',
      description: 'Выберите лодку перед назначением',
      color: 'error'
    })
    return
  }

  assigningUser.value = userId

  try {
    // Проверяем существующее назначение
    const { data: existing, error: checkError } = await $supabase
      .from('boat_managers')
      .select('*')
      .eq('boat_id', selectedBoatId.value)
      .eq('user_id', userId)
    
    if (checkError) throw checkError
    
    if (existing && existing.length > 0) {
      toast.add({
        title: 'Информация',
        description: 'Этот пользователь уже является менеджером данной лодки',
        color: 'warning'
      })
      return
    }

    // Создаем новое назначение
    const { error: insertError } = await $supabase
      .from('boat_managers')
      .insert([{
        boat_id: selectedBoatId.value,
        user_id: userId
      }])
    
    if (insertError) throw insertError

    toast.add({
      title: 'Успешно',
      description: 'Менеджер назначен',
      color: 'success'
    })

    // Обновляем список пользователей
    await loadUsers()
  } catch (error) {
    console.error('Ошибка назначения менеджера:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось назначить менеджера',
      color: 'error'
    })
  } finally {
    assigningUser.value = null
  }
}

// Инициализация
onMounted(async () => {
  await checkAdminAccess()
  if (isAdmin.value) {
    await Promise.all([loadBoats(), loadUsers()])
  }
  isLoading.value = false
})
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <h1 class="text-2xl font-bold mb-6">Управление менеджерами лодок</h1>

    <!-- Отладочная информация -->
    <UCard class="mb-6">
      <template #header>
        <h3 class="text-lg font-medium">Отладочная информация</h3>
      </template>
      <div class="p-4 text-xs">
        <p class="mb-2"><strong>Статус загрузки:</strong> {{ isLoading ? 'Загрузка...' : 'Загружено' }}</p>
        <p class="mb-2"><strong>Текущий пользователь:</strong> {{ currentUser?.email || 'Не задан' }}</p>
        <p class="mb-2"><strong>Права администратора:</strong> {{ isAdmin ? 'Да' : 'Нет' }}</p>
        <p class="mb-2"><strong>Доступных лодок:</strong> {{ boats.length }}</p>
        <p class="mb-2"><strong>Выбранная лодка:</strong> {{ selectedBoat?.label || 'Не выбрана' }}</p>
        <p class="mb-2"><strong>Доступных пользователей:</strong> {{ users.length }}</p>
      </div>
    </UCard>

    <!-- Лоадер -->
    <div v-if="isLoading" class="text-center py-8">
      <UProgress animation="carousel" />
      <p class="mt-2 text-gray-600">Загрузка данных...</p>
    </div>

    <!-- Основной интерфейс -->
    <div v-else>
      <!-- Выбор лодки -->
      <UCard class="mb-6">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Выберите лодку</h2>
            <div class="flex items-center gap-2">
              <UButton
                @click="loadBoats"
                variant="soft"
                color="primary"
                icon="i-heroicons-arrow-path"
                size="sm"
                :loading="isLoading"
              >
                Обновить
              </UButton>
              <UBadge color="info" variant="soft">{{ boats.length }} лодок</UBadge>
            </div>
          </div>
        </template>
        
        <div class="p-4">
          <USelectMenu
            v-model="selectedBoat"
            :items="boats"
            value-attribute="value"
            option-attribute="label"
            placeholder="Выберите лодку"
            class="w-full"
            :searchable="boats.length > 5"
          />
          
          <p v-if="!boats.length" class="text-red-500 mt-2">
            Нет доступных лодок. Сначала создайте лодку через админ-панель!
          </p>
        </div>
      </UCard>

      <!-- Если лодка выбрана -->
      <div v-if="selectedBoatId">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Левая колонка: Текущие менеджеры -->
          <div>
            <BoatManagerList 
              :boat-id="selectedBoatId" 
              @update="loadUsers" 
            />
          </div>
          
          <!-- Правая колонка: Назначение новых менеджеров -->
          <div>
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="text-xl font-semibold">Назначить менеджера</h2>
                  <UBadge color="success" variant="soft">Добавить</UBadge>
                </div>
              </template>
              
              <div class="p-4">
                <!-- Поиск пользователей -->
                <div class="mb-4">
                  <UInput
                    v-model="searchQuery"
                    icon="i-heroicons-magnifying-glass"
                    placeholder="Поиск по имени или email"
                    class="mb-2"
                  />
                </div>
                
                <!-- Список пользователей -->
                <div v-if="filteredUsers.length" class="space-y-3 max-h-[400px] overflow-y-auto">
                  <TransitionGroup name="list">
                    <UCard
                      v-for="user in filteredUsers"
                      :key="user.id"
                      class="hover:shadow-lg transition-shadow"
                    >
                      <div class="flex items-center justify-between p-4">
                        <div>
                          <p class="font-semibold">{{ user.name || 'Без имени' }}</p>
                          <p class="text-sm text-gray-600">{{ user.email }}</p>
                          <div class="flex items-center mt-1">
                            <UBadge
                              :color="user.role === 'agent' ? 'info' : 'secondary'"
                              variant="soft"
                              size="xs"
                            >
                              {{ user.role === 'agent' ? 'Агент' : 'Пользователь' }}
                            </UBadge>
                            <p v-if="user.phone" class="ml-2 text-xs text-gray-500">{{ user.phone }}</p>
                          </div>
                        </div>
                        <UButton
                          @click="assignManager(user.id)"
                          icon="i-heroicons-user-plus"
                          color="primary"
                          :loading="assigningUser === user.id"
                        >
                          Назначить
                        </UButton>
                      </div>
                    </UCard>
                  </TransitionGroup>
                </div>
                
                <div v-else class="text-center py-8 text-gray-500">
                  {{ searchQuery ? 'Нет пользователей, соответствующих поиску' : 'Нет доступных пользователей для назначения' }}
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </div>
      
      <!-- Если лодка не выбрана -->
      <UCard v-else class="text-center py-8">
        <UIcon name="i-heroicons-arrow-up" class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-lg font-medium text-gray-900">Выберите лодку</h3>
        <p class="mt-1 text-sm text-gray-500">
          Для управления менеджерами сначала выберите лодку из списка выше
        </p>
      </UCard>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
