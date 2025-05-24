<template>
  <div class="boat-manager-list">
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Текущие менеджеры лодки</h2>
          <UBadge color="info" variant="soft">{{ managers.length }} менеджеров</UBadge>
        </div>
      </template>
      
      <!-- Отладочная информация -->
      <div class="mb-4 p-3 bg-gray-100 rounded-md text-sm">
        <p class="font-medium">Отладочная информация:</p>
        <div class="mt-2 text-xs">
          <p>ID лодки: {{ props.boatId }}</p>
          <p>Загружено менеджеров: {{ managers.length }}</p>
          <p>Статус загрузки: {{ loading ? 'Загрузка...' : 'Загружено' }}</p>
          <pre class="mt-2 overflow-auto max-h-40">{{ JSON.stringify(managers, null, 2) }}</pre>
        </div>
      </div>
      
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-8">
        <UProgress animation="carousel" />
      </div>
      
      <!-- Main content -->
      <div v-else>
        <div v-if="managers.length" class="space-y-3">
          <TransitionGroup name="list">
            <UCard
              v-for="manager in managers"
              :key="manager.id"
              class="border-l-4 border-blue-500"
            >
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3">
                    <UAvatar 
                      :text="getUserInitials(manager.profiles)"
                      :ui="{
                        text: 'text-white font-medium'
                      }"
                      class="bg-blue-500"
                    />
                    <div>
                      <h3 class="font-medium">{{ manager.profiles?.name || 'Без имени' }}</h3>
                      <p class="text-sm text-gray-500">{{ manager.profiles?.email }}</p>
                      <p v-if="manager.profiles?.phone" class="text-xs text-gray-500">{{ manager.profiles.phone }}</p>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 self-end md:self-center">
                  <UButton
                    color="red"
                    variant="soft"
                    icon="i-heroicons-trash"
                    @click="confirmRemoveManager(manager)"
                  >
                    Удалить
                  </UButton>
                </div>
              </div>
            </UCard>
          </TransitionGroup>
        </div>
        
        <div v-else class="text-center py-10">
          <UIcon name="i-heroicons-user-group" class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-lg font-medium text-gray-900">Нет менеджеров</h3>
          <p class="mt-1 text-sm text-gray-500">
            Для этой лодки еще не назначены менеджеры
          </p>
        </div>
      </div>
    </UCard>
    
    <!-- Confirmation modal -->
    <UModal v-model="isConfirmModalOpen">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">Подтверждение удаления</h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="i-heroicons-x-mark"
              @click="isConfirmModalOpen = false"
            />
          </div>
        </template>
        
        <div class="p-4">
          <p>Вы уверены, что хотите удалить этого менеджера?</p>
          <p class="mt-2 font-medium">{{ managerToRemove?.profiles?.name || managerToRemove?.profiles?.email }}</p>
        </div>
        
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="gray"
              variant="soft"
              @click="isConfirmModalOpen = false"
            >
              Отмена
            </UButton>
            <UButton
              color="red"
              :loading="isRemoving"
              @click="removeManager"
            >
              Удалить
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  boatId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update'])

const { $supabase } = useNuxtApp()
const toast = useToast()

// State
const managers = ref([])
const loading = ref(true)
const isConfirmModalOpen = ref(false)
const managerToRemove = ref(null)
const isRemoving = ref(false)

// Load managers for the boat
const loadManagers = async () => {
  if (!props.boatId) return
  
  try {
    loading.value = true
    
    // Получаем список менеджеров для лодки
    const { data, error } = await $supabase
      .from('boat_managers')
      .select('user_id')
      .eq('boat_id', props.boatId)
    
    if (error) throw error
    
    if (!data || data.length === 0) {
      managers.value = []
      return
    }
    
    // Получаем профили менеджеров
    const userIds = data.map(item => item.user_id)
    const { data: profilesData, error: profilesError } = await $supabase
      .from('profiles')
      .select('id, name, email, avatar')
      .in('id', userIds)
    
    if (profilesError) throw profilesError
    
    managers.value = profilesData || []
  } catch (error) {
    console.error('Ошибка при загрузке менеджеров:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список менеджеров',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Helper methods
const getUserInitials = (user) => {
  if (!user || !user.name) {
    return user?.email?.charAt(0).toUpperCase() || '?'
  }
  
  const nameParts = user.name.split(' ')
  if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase()
  
  return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
}

// Remove manager
const confirmRemoveManager = (manager) => {
  managerToRemove.value = manager
  isConfirmModalOpen.value = true
}

const removeManager = async () => {
  if (!managerToRemove.value) return
  
  try {
    isRemoving.value = true
    
    
    const { error } = await $supabase
      .from('boat_managers')
      .delete()
      .eq('id', managerToRemove.value.id)
      
    if (error) throw error
    
    toast.add({
      title: 'Успешно',
      description: 'Менеджер удален',
      color: 'success'
    })
    
    // Remove from local state
    managers.value = managers.value.filter(m => m.id !== managerToRemove.value?.id)
    
    // Notify parent
    emit('update')
  } catch (error) {
    console.error('Error removing manager:', error)
    toast.add({
      title: 'Ошибка',
      description: 'Не удалось удалить менеджера',
      color: 'error'
    })
  } finally {
    isRemoving.value = false
    isConfirmModalOpen.value = false
    managerToRemove.value = null
  }
}

// Watch for boatId changes
watch(() => props.boatId, (newId) => {
  if (newId) {
    loadManagers()
  }
})

// Initialize
onMounted(() => {
  if (props.boatId) {
    loadManagers()
  }
})
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