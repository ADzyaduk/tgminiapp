<!-- Login.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center p-4 ">
    <UCard class="w-full max-w-md">
      <template #header>
        <h1 class="text-2xl font-bold text-center">Вход в аккаунт</h1>
      </template>

      <form @submit.prevent="handleLogin" class="space-y-4">
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
            type="password"
            placeholder="Ваш пароль"
            icon="i-heroicons-lock-closed"
            autocomplete="current-password"
          />
        </UFormField>

        <UButton
          type="submit"
          block
          :loading="loading"
          :disabled="loading || !isValid"
        >
          Войти
        </UButton>

        <div class="text-center text-sm mt-4">
          Нет аккаунта?
          <NuxtLink to="/register" class="text-primary-600 hover:underline">
            Зарегистрироваться
          </NuxtLink>
        </div>
      </form>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useToast, useSupabaseClient } from '#imports'
import { useAuth } from '~/composables/useAuth'

interface LoginForm { email: string; password: string }

const supabaseClient = useSupabaseClient()
const router = useRouter()
const toast = useToast()
const { fetchUser, user } = useAuth()

const form = ref<LoginForm>({ email: '', password: '' })
const errors = ref<Partial<Record<keyof LoginForm, string>>>({})
const loading = ref(false)

const isValid = computed(() => {
  return form.value.email.trim() !== '' && form.value.password.trim().length >= 6
})

async function handleLogin() {
  errors.value = {}
  if (!isValid.value) {
    if (!form.value.email) errors.value.email = 'Email обязателен'
    if (form.value.password.length < 6) errors.value.password = 'Пароль минимум 6 символов'
    return
  }

  loading.value = true
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: form.value.email,
      password: form.value.password,
    })
    
    if (error) throw error
    
    toast.add({ title: 'Успешный вход!', color: 'success' })
    
    // Добавляем небольшую задержку перед редиректом
    setTimeout(() => {
      router.push('/')
    }, 500)
  } catch (err: any) {
    console.error('Login error:', err)
    toast.add({ title: 'Ошибка входа', description: err.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Убираем стили фона для использования темы Nuxt UI по умолчанию */
</style>