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
      <div class="mb-4 p-3  rounded-md text-sm">
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
            <UCard v-for="manager in managers" :key="manager.id" class="border-l-4 border-blue-500">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
                <div class="flex-1">
                  <div class="flex items-center gap-3">
                    <UAvatar :text="getUserInitials(manager)" class="bg-blue-500" />
                    <div>
                      <h3 class="font-medium">{{ manager.name || 'Без имени' }}</h3>
                      <p class="text-sm text-gray-500">{{ manager.email }}</p>
                      <p v-if="manager.phone" class="text-xs text-gray-500">{{ manager.phone }}</p>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 self-end md:self-center">
                  <!-- Inline confirmation -->
                  <div v-if="managerToRemove?.id === manager.id" class="flex gap-2">
                    <UButton color="error" variant="soft" size="sm" :loading="isRemoving" @click="removeManager">
                      Подтвердить
                    </UButton>
                    <UButton color="neutral" variant="soft" size="sm" @click="managerToRemove = null">
                      Отмена
                    </UButton>
                  </div>
                  <UButton v-else color="error" variant="soft" icon="i-heroicons-trash"
                    @click="confirmRemoveManager(manager)" size="sm">
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

// Types
interface Manager {
  id: string
  name: string
  email: string
  phone?: string
  avatar?: string
}

// State
const managers = ref<Manager[]>([])
const loading = ref(true)
const managerToRemove = ref<Manager | null>(null)
const isRemoving = ref(false)

// Load managers for the boat - переделаем под новую авторизацию
const loadManagers = async () => {
  if (!props.boatId) return

  try {
    loading.value = true

    // TODO: Заменить на новый API с Telegram auth
    console.log('🔄 Загрузка менеджеров для лодки:', props.boatId)

    // Временно заглушка
    managers.value = []

  } catch (error) {
    console.error('Ошибка при загрузке менеджеров:', error)
    useToast().add({
      title: 'Ошибка',
      description: 'Не удалось загрузить список менеджеров',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// Helper methods
const getUserInitials = (user: Manager) => {
  if (!user || !user.name) {
    return user?.email?.charAt(0).toUpperCase() || '?'
  }

  const nameParts = user.name.split(' ')
  if (nameParts.length === 1) return nameParts[0].charAt(0).toUpperCase()

  return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase()
}

// Remove manager
const confirmRemoveManager = (manager: Manager) => {
  managerToRemove.value = manager
}

const removeManager = async () => {
  if (!managerToRemove.value) return

  try {
    isRemoving.value = true

    // TODO: Заменить на новый API с Telegram auth
    console.log('🗑️ Удаление менеджера:', managerToRemove.value.id)

    useToast().add({
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
    useToast().add({
      title: 'Ошибка',
      description: 'Не удалось удалить менеджера',
      color: 'error'
    })
  } finally {
    isRemoving.value = false
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
