<template>
  <div class="container mx-auto p-4">
    <UCard class="mb-4">
      <template #header>
        <div class="flex justify-between items-center">
          <h1 class="text-xl font-semibold">Админ-панель: Управление приглашениями</h1>
          <NuxtLink to="/admin">
            <UButton variant="ghost" color="gray" icon="i-heroicons-arrow-left">
              Назад к панели
            </UButton>
          </NuxtLink>
        </div>
      </template>
    </UCard>
    
    <div v-if="isLoading" class="flex justify-center my-8">
      <ULoading size="lg" color="primary" />
    </div>
    
    <UAlert v-else-if="!isAdmin" type="danger" title="Доступ запрещен" class="my-8">
      У вас нет доступа к этой странице. Требуются права администратора.
    </UAlert>
    
    <template v-else>
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">Приглашения менеджеров</h2>
        </template>
        <p>Раздел управления приглашениями менеджеров. (В разработке)</p>
        <!-- TODO: Реализовать функционал отображения и управления приглашениями -->
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '~/composables/useAuth'

const router = useRouter()
const { user, isAdmin, loading } = useAuth()

const isLoading = ref(true)

onMounted(async () => {
  // Проверяем аутентификацию и права доступа
  await new Promise(resolve => setTimeout(resolve, 500))
  
  if (!loading.value && !user.value) {
    // Перенаправляем на логин, если пользователь не авторизован
    router.push('/login?redirect=/admin/invites')
    return
  }
  
  isLoading.value = false
})
</script> 