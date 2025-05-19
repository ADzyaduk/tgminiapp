<template>
  <div class="max-w-3xl mx-auto">
    <UCard>
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">Управление приглашениями</h2>
          <UButton 
            color="primary"
            @click="showCreateForm = !showCreateForm"
            :icon="showCreateForm ? 'i-heroicons-x-mark' : 'i-heroicons-plus'"
          >
            {{ showCreateForm ? 'Отмена' : 'Создать приглашение' }}
          </UButton>
        </div>
      </template>
      
      <!-- Форма создания приглашения -->
      <div v-if="showCreateForm" class="bg-muted p-4 rounded-md mb-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <UFormGroup label="Роль пользователя">
            <USelect
              v-model="newInvite.role"
              :options="roleOptions"
              placeholder="Выберите роль"
            />
          </UFormGroup>
          
          <UFormGroup label="Количество использований">
            <UInput
              v-model.number="newInvite.usageLimit"
              type="number"
              min="1"
              placeholder="По умолчанию 1"
            />
          </UFormGroup>
          
          <UFormGroup label="Срок действия" class="md:col-span-2">
            <UInput
              v-model="newInvite.expiresAt"
              type="date"
              :min="minDate"
              placeholder="Без ограничения"
            />
          </UFormGroup>
          
          <UFormGroup label="Примечание" class="md:col-span-2">
            <UTextarea
              v-model="newInvite.note"
              placeholder="Необязательное примечание"
              :rows="2"
            />
          </UFormGroup>
        </div>
        
        <div class="flex justify-end">
          <UButton
            color="primary"
            :loading="isCreating"
            :disabled="!newInvite.role"
            @click="createInvite"
          >
            Создать приглашение
          </UButton>
        </div>
      </div>
      
      <!-- Список приглашений -->
      <div>
        <UTable
          :columns="tableColumns"
          :rows="invites"
          :loading="isLoading"
          :empty-state="{ icon: 'i-heroicons-inbox', label: 'Нет доступных приглашений' }"
        >
          <template #code-data="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm">{{ row.code }}</span>
              <UButton 
                icon="i-heroicons-clipboard-document" 
                color="neutral" 
                variant="ghost" 
                size="xs"
                @click="copyInviteCode(row.code)"
              />
            </div>
          </template>
          
          <template #role-data="{ row }">
            <UBadge :color="getRoleBadgeColor(row.role)">
              {{ getRoleLabel(row.role) }}
            </UBadge>
          </template>
          
          <template #status-data="{ row }">
            <div class="flex items-center gap-2">
              <div
                class="w-2 h-2 rounded-full"
                :class="isExpired(row) ? 'bg-error' : 'bg-success'"
              ></div>
              <span v-if="isExpired(row)" class="text-sm text-error">Истек</span>
              <span v-else class="text-sm text-success">Активен</span>
            </div>
          </template>
          
          <template #expires-at-data="{ row }">
            <span v-if="row.expires_at">{{ formatDate(row.expires_at) }}</span>
            <span v-else class="text-muted">Бессрочно</span>
          </template>
          
          <template #usage-data="{ row }">
            <span>{{ row.used_count || 0 }} из {{ row.usage_limit || '∞' }}</span>
          </template>
          
          <template #actions-data="{ row }">
            <div class="flex items-center gap-2">
              <UButton
                icon="i-heroicons-arrow-path"
                color="primary"
                variant="ghost"
                size="xs"
                :disabled="isExpired(row)"
                @click="regenerateInvite(row)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="xs"
                @click="deleteInvite(row)"
              />
            </div>
          </template>
        </UTable>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSupabaseClient } from '#imports'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { useNuxtApp } from 'nuxt/app'

// Supabase клиент
const supabase = useSupabaseClient()

// Инициализируем toast
const { $toast: toast } = useNuxtApp()

// Состояние
const invites = ref<any[]>([])
const isLoading = ref(false)
const isCreating = ref(false)
const showCreateForm = ref(false)
const minDate = computed(() => {
  const today = new Date()
  return today.toISOString().slice(0, 10)
})

// Новое приглашение
const newInvite = ref({
  role: 'agent',
  usageLimit: 1,
  expiresAt: '',
  note: ''
})

// Опции ролей
const roleOptions = [
  { label: 'Агент', value: 'agent' },
  { label: 'Менеджер', value: 'manager' },
  { label: 'Администратор', value: 'admin' }
]

// Колонки таблицы
const tableColumns = [
  { key: 'code', label: 'Код приглашения' },
  { key: 'role', label: 'Роль' },
  { key: 'status', label: 'Статус' },
  { key: 'expires_at', label: 'Истекает' },
  { key: 'usage', label: 'Использовано' },
  { key: 'actions', label: 'Действия' }
]

// Загрузка приглашений
async function fetchInvites() {
  isLoading.value = true
  
  const { data, error } = await supabase
    .from('invites')
    .select('*, used_profiles:used_by(name, email)')
    .order('created_at', { ascending: false })
  
  if (!error && data) {
    invites.value = data
  }
  
  isLoading.value = false
}

// Создание нового приглашения
async function createInvite() {
  if (!newInvite.value.role) return
  
  isCreating.value = true
  
  // Генерация кода приглашения
  const code = generateInviteCode()
  
  const { error } = await supabase
    .from('invites')
    .insert({
      code,
      role: newInvite.value.role,
      usage_limit: newInvite.value.usageLimit || 1,
      expires_at: newInvite.value.expiresAt || null,
      note: newInvite.value.note || null,
      used: false,
      used_count: 0
    })
  
  if (!error) {
    // Сбрасываем форму
    newInvite.value = {
      role: 'agent',
      usageLimit: 1,
      expiresAt: '',
      note: ''
    }
    showCreateForm.value = false
    
    // Обновляем список
    await fetchInvites()
  }
  
  isCreating.value = false
}

// Обновление приглашения
async function regenerateInvite(invite: any) {
  const code = generateInviteCode()
  
  const { error } = await supabase
    .from('invites')
    .update({
      code,
      used: false,
      used_count: 0,
      used_by: null,
      used_at: null
    })
    .eq('id', invite.id)
  
  if (!error) {
    await fetchInvites()
  }
}

// Удаление приглашения
async function deleteInvite(invite: any) {
  if (!confirm('Вы уверены, что хотите удалить это приглашение?')) return
  
  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', invite.id)
  
  if (!error) {
    await fetchInvites()
  }
}

// Вспомогательные функции
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  // Генерация кода формата XXXXX-XXXXX-XXXXX
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 5; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    if (i < 2) code += '-'
  }
  
  return code
}

// Копировать код приглашения в буфер обмена
function copyInviteCode(code: string) {
  navigator.clipboard.writeText(code)
    .then(() => {
      toast.success('Код скопирован в буфер обмена')
    })
    .catch(err => {
      console.error('Ошибка при копировании: ', err)
      toast.error('Не удалось скопировать код')
    })
}

function formatDate(dateString: string) {
  return format(new Date(dateString), 'PPP', { locale: ru })
}

function isExpired(invite: any) {
  if (!invite.expires_at) return false
  
  const expireDate = new Date(invite.expires_at)
  return expireDate < new Date()
}

function getRoleLabel(role: string) {
  switch (role) {
    case 'admin': return 'Администратор'
    case 'manager': return 'Менеджер'
    case 'agent': return 'Агент'
    default: return role
  }
}

function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'admin': return 'red'
    case 'manager': return 'purple'
    case 'agent': return 'blue'
    default: return 'gray'
  }
}

// Загружаем приглашения при монтировании
onMounted(() => {
  fetchInvites()
})
</script> 