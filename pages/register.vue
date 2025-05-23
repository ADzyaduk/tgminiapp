<template>
  <div class="flex min-h-screen items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
    <UCard class="w-full max-w-md shadow-lg">
      <template #header>
        <div class="text-center mb-4">
          <h1 class="text-3xl font-bold text-gray-800 dark:text-white pt-4">Регистрация</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">Создайте новый аккаунт, чтобы начать</p>
        </div>
      </template>
      
      <div class="py-4">
        <UAlert v-if="genericErrorMessage" color="error" variant="soft" icon="i-heroicons-exclamation-circle" :description="genericErrorMessage" class="mb-6" />
        
        <UFormGroup label="Электронная почта" name="email" required :error="emailError" class="mb-6">
          <UInput 
            v-model="email" 
            type="email" 
            placeholder="your@email.com" 
            icon="i-heroicons-envelope"
            class="w-full mb-2"
            size="lg" 
            @blur="validateEmail"
          />
        </UFormGroup>
        
        <UFormGroup label="Пароль" name="password" required :error="passwordError">
          <UInput 
            v-model="password" 
            :type="showPassword ? 'text' : 'password'" 
            placeholder="Минимум 8 символов" 
            icon="i-heroicons-lock-closed"
            class="w-full mb-2"
            size="lg"
            @blur="validatePassword"
          >
            <template #trailing>
              <UButton 
                :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'" 
                variant="link" 
                @click="showPassword = !showPassword" 
                :padded="false"
              />
            </template>
          </UInput>
        </UFormGroup>
        
        <UFormGroup label="Имя" name="name" required :error="nameError">
          <UInput 
            v-model="name" 
            placeholder="Ваше имя" 
            icon="i-heroicons-user"
            class="w-full mb-2"
            size="lg"
            @blur="validateName"
          />
        </UFormGroup>
        
        <UFormGroup label="Телефон" name="phone" :error="phoneError">
          <UInput 
            v-model="phone" 
            type="tel" 
            placeholder="(XXX) XXX-XX-XX" 
            icon="i-heroicons-phone"
            class="w-full mb-2"
            size="lg"
            @blur="validatePhone"
          >
            <template #leading>
              <span class="text-gray-500">+7</span>
            </template>
          </UInput>
        </UFormGroup>
      </div>
      
      <template #footer>
        <div class="flex flex-col gap-4 mt-4">
          <UButton 
            color="primary" 
            block 
            :loading="isLoading" 
            :disabled="isSubmitDisabled"
            @click="handleRegister"
            size="xl"
            class="font-semibold"
          >
            Зарегистрироваться
          </UButton>
          <div class="text-center mt-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Уже есть аккаунт? </span>
            <UButton variant="link" to="/login" class="text-primary-600 dark:text-primary-400 font-medium">
              Войти
            </UButton>
          </div>
        </div>
      </template>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSupabaseClient, useNuxtApp } from '#imports'
import { useRouter } from 'vue-router'

const router = useRouter()
const supabase = useSupabaseClient()
const { $toast } = useNuxtApp()

// Form state
const email = ref('')
const password = ref('')
const name = ref('')
const phone = ref('')
const showPassword = ref(false)

// Loading and error states
const isLoading = ref(false)
const genericErrorMessage = ref('')

// Field-specific error states
const emailError = ref('')
const passwordError = ref('')
const nameError = ref('')
const phoneError = ref('')

// Validation functions
const validateEmail = () => {
  emailError.value = ''
  if (!email.value) {
    emailError.value = 'Электронная почта обязательна.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    emailError.value = 'Введите корректный адрес электронной почты.'
  }
  return !emailError.value
}

const validatePassword = () => {
  passwordError.value = ''
  if (!password.value) {
    passwordError.value = 'Пароль обязателен.'
  } else if (password.value.length < 8) {
    passwordError.value = 'Пароль должен содержать минимум 8 символов.'
  }
  return !passwordError.value
}

const validateName = () => {
  nameError.value = ''
  if (!name.value) {
    nameError.value = 'Имя обязательно.'
  } else if (name.value.length < 2) {
    nameError.value = 'Имя должно содержать минимум 2 символа.'
  }
  return !nameError.value
}

const validatePhone = () => {
  phoneError.value = ''
  if (phone.value) {
    // Remove any non-digit characters for validation
    const digitsOnly = phone.value.replace(/\D/g, '')
    if (digitsOnly.length < 10 || digitsOnly.length > 11) {
      phoneError.value = 'Введите корректный номер телефона.'
    }
  }
  return !phoneError.value
}

const validateForm = () => {
  const isEmailValid = validateEmail()
  const isPasswordValid = validatePassword()
  const isNameValid = validateName()
  const isPhoneValid = validatePhone()
  return isEmailValid && isPasswordValid && isNameValid && isPhoneValid
}

// Computed property for submit button state
const isSubmitDisabled = computed(() => {
  return isLoading.value || !email.value || !password.value || !name.value || 
         !!emailError.value || !!passwordError.value || !!nameError.value || !!phoneError.value ||
         password.value.length < 8
})

// Registration function
async function handleRegister() {
  genericErrorMessage.value = ''
  if (!validateForm()) {
    $toast.error('Пожалуйста, исправьте ошибки в форме.')
    return
  }
  
  isLoading.value = true
  
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          full_name: name.value,
          phone: phone.value ? `+7${phone.value.replace(/\D/g, '')}` : null,
        }
      }
    })
    
    if (authError) {
      genericErrorMessage.value = authError.message
      if (authError.message.includes('Email rate limit exceeded')) {
         genericErrorMessage.value = 'Слишком много запросов. Пожалуйста, попробуйте позже.'
      } else if (authError.message.includes('User already registered')) {
         genericErrorMessage.value = 'Пользователь с таким email уже зарегистрирован.'
         emailError.value = 'Этот email уже используется.'
      } else {
         genericErrorMessage.value = 'Ошибка регистрации: ' + authError.message
      }
      $toast.error(genericErrorMessage.value)
    } else if (authData.user) {
      if (authData.user.identities && authData.user.identities.length > 0 && !authData.user.email_confirmed_at) {
        $toast.success('Регистрация почти завершена! Пожалуйста, проверьте свою почту и подтвердите ваш email адрес.')
      } else {
        $toast.success('Регистрация успешна! Добро пожаловать!')
        router.push('/') 
      }
      email.value = '';
      password.value = '';
      name.value = '';
      phone.value = '';
    } else {
        $toast.info('Пожалуйста, проверьте свою почту для завершения регистрации.')
    }

  } catch (error: any) {
    genericErrorMessage.value = error.message || 'Произошла непредвиденная ошибка при регистрации.'
    $toast.error(genericErrorMessage.value)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Existing styles are fine, no new specific styles added here for now */
/* Consider adding styles for .form-group-error text if not handled by Nuxt UI error prop */
</style>
