<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-xl font-semibold">Регистрация для агентов</h1>
        <p class="text-sm text-gray-500 mt-1">Для регистрации необходим код приглашения</p>
      </template>
      
      <div class="space-y-4">
        <UAlert v-if="errorMessage" color="red" variant="soft" :description="errorMessage" class="mb-4" />
        
        <UFormGroup label="Электронная почта" required>
          <UInput v-model="email" type="email" placeholder="your@email.com" />
        </UFormGroup>
        
        <UFormGroup label="Пароль" required>
          <UInput v-model="password" type="password" placeholder="Минимум 8 символов" />
        </UFormGroup>
        
        <UFormGroup label="Имя" required>
          <UInput v-model="name" placeholder="Ваше имя" />
        </UFormGroup>
        
        <UFormGroup label="Телефон">
          <UInput v-model="phone" type="tel" placeholder="+7 (XXX) XXX-XX-XX" />
        </UFormGroup>
        
        <UFormGroup label="Код приглашения" required>
          <UInput v-model="inviteCode" placeholder="XXXXX-XXXXX-XXXXX" />
        </UFormGroup>
      </div>
      
      <template #footer>
        <div class="flex flex-col gap-4">
          <UButton 
            color="primary" 
            block 
            :loading="isLoading" 
            :disabled="isDisabled"
            @click="register"
          >
            Зарегистрироваться
          </UButton>
          <div class="text-center">
            <UButton variant="link" to="/login">Уже есть аккаунт? Войти</UButton>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSupabaseClient } from '#imports'
import { useRouter } from 'vue-router'

interface InviteData {
  id: string
  code: string
  role: string
  used: boolean
  used_by?: string
  used_at?: string
  created_at: string
  created_by?: string
  expires_at?: string
  usage_limit?: number
  used_count?: number
  note?: string
}

const router = useRouter()
const supabase = useSupabaseClient()

// Состояние формы
const email = ref('')
const password = ref('')
const name = ref('')
const phone = ref('')
const inviteCode = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

// Валидация формы
const isDisabled = computed(() => {
  return !email.value || !password.value || !name.value || !inviteCode.value || password.value.length < 8
})

// Регистрация
async function register() {
  if (isDisabled.value) return
  
  errorMessage.value = ''
  isLoading.value = true
  
  try {
    // 1. Проверяем код приглашения
    const { data: inviteData, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('code', inviteCode.value)
      .eq('used', false)
      .single()
    
    if (inviteError || !inviteData) {
      errorMessage.value = 'Неверный или уже использованный код приглашения'
      isLoading.value = false
      return
    }
    
    // 2. Регистрируем пользователя
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          name: name.value,
          phone: phone.value || null,
          role: (inviteData as InviteData).role || 'agent' // Роль из приглашения или по умолчанию 'agent'
        }
      }
    })
    
    if (authError) {
      errorMessage.value = authError.message
      isLoading.value = false
      return
    }
    
    // 3. Отмечаем приглашение как использованное
    await supabase
      .from('invites')
      .update({ 
        used: true,
        used_by: authData.user?.id,
        used_at: new Date().toISOString()
      } as any)
      .eq('code', inviteCode.value)
    
    // 4. Перенаправляем на главную или страницу подтверждения
    router.push('/')
  } catch (error: any) {
    errorMessage.value = error.message || 'Произошла ошибка при регистрации'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Убираем стили фона для использования темы Nuxt UI по умолчанию */
</style>
