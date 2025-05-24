<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-2xl font-bold text-center">Регистрация</h1>
      </template>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <UFormField label="Email" :error="errors.email" required>
          <UInput
            v-model="form.email"
            type="email"
            placeholder="Ваш email"
            icon="i-heroicons-envelope"
            autocomplete="email"
          />
        </UFormField>

        <UFormField label="Пароль" :error="errors.password" required>
          <UInput
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Минимум 8 символов"
            icon="i-heroicons-lock-closed"
            autocomplete="new-password"
          >
            <template #trailing>
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                @click="showPassword = !showPassword"
                :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              />
            </template>
          </UInput>
        </UFormField>

        <UFormField label="Имя" :error="errors.name" required>
          <UInput
            v-model="form.name"
            placeholder="Ваше имя"
            icon="i-heroicons-user"
            autocomplete="name"
          />
        </UFormField>

        <UFormField label="Телефон" :error="errors.phone">
          <UInput
            v-model="form.phone"
            type="tel"
            placeholder="(XXX) XXX-XX-XX"
            icon="i-heroicons-phone"
            autocomplete="tel"
          >
            <template #leading>
              <span class="text-gray-500">+7</span>
            </template>
          </UInput>
        </UFormField>

        <UButton
          type="submit"
          block
          :loading="loading"
          :disabled="loading || !isValid"
        >
          Зарегистрироваться
        </UButton>

        <div class="text-center text-sm mt-4">
          Уже есть аккаунт?
          <NuxtLink to="/login" class="text-primary-600 hover:underline">
            Войти
          </NuxtLink>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '#imports'
import { useAuth } from '~/composables/useAuth'

interface RegisterForm {
  email: string
  password: string
  name: string
  phone: string
}

const router = useRouter()
const toast = useToast()
const { signUp, isLoggedIn } = useAuth()

const form = ref<RegisterForm>({ 
  email: '', 
  password: '', 
  name: '', 
  phone: '' 
})
const errors = ref<Partial<Record<keyof RegisterForm, string>>>({})
const loading = ref(false)
const showPassword = ref(false)

const isValid = computed(() => {
  return form.value.email.trim() !== '' && 
         form.value.password.trim().length >= 8 && 
         form.value.name.trim() !== ''
})

// Перенаправляем если уже авторизован
watch(isLoggedIn, (newValue) => {
  if (newValue) {
    router.push('/')
  }
}, { immediate: true })

// Валидация
const validateForm = () => {
  errors.value = {}
  
  if (!form.value.email) {
    errors.value.email = 'Email обязателен'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = 'Введите корректный email'
  }
  
  if (!form.value.password) {
    errors.value.password = 'Пароль обязателен'
  } else if (form.value.password.length < 8) {
    errors.value.password = 'Пароль должен содержать минимум 8 символов'
  }
  
  if (!form.value.name) {
    errors.value.name = 'Имя обязательно'
  } else if (form.value.name.length < 2) {
    errors.value.name = 'Имя должно содержать минимум 2 символа'
  }
  
  if (form.value.phone) {
    const digitsOnly = form.value.phone.replace(/\D/g, '')
    if (digitsOnly.length < 10 || digitsOnly.length > 11) {
      errors.value.phone = 'Введите корректный номер телефона'
    }
  }
  
  return Object.keys(errors.value).length === 0
}

async function handleRegister() {
  if (!validateForm()) {
    return
  }

  loading.value = true
  try {
    const metadata = {
      full_name: form.value.name,
      phone: form.value.phone ? `+7${form.value.phone.replace(/\D/g, '')}` : null,
    }
    
    const result = await signUp(form.value.email, form.value.password, metadata)
    
    if (!result.success) {
      if (result.error.includes('User already registered')) {
        errors.value.email = 'Этот email уже используется'
        toast.add({ title: 'Пользователь с таким email уже зарегистрирован', color: 'error' })
      } else {
        toast.add({ title: 'Ошибка регистрации', description: result.error, color: 'error' })
      }
    } else {
      toast.add({ 
        title: 'Регистрация завершена!', 
        description: 'Проверьте свою почту для подтверждения email',
        color: 'success' 
      })
      
      // Очищаем форму
      form.value = { email: '', password: '', name: '', phone: '' }
    }
  } catch (err: any) {
    console.error('Registration error:', err)
    toast.add({ title: 'Ошибка регистрации', description: err.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script> 