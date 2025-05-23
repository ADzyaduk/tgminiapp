<template>
  <div class="container mx-auto p-4">
    <!-- Панель пользователя -->
    <UCard class="mb-4">
      <div v-if="user" class="flex items-center justify-between">
        <div>
          <p class="font-semibold">{{ user.email }}</p>
          <p class="text-sm text-gray-500">
            Статус: {{ isAdmin ? 'Администратор' : isManager ? 'Менеджер' : 'Пользователь' }}
          </p>
        </div>
        <UButton @click="signOut" variant="ghost">Выйти</UButton>
      </div>
      <div v-else class="flex items-center gap-4">
        <NuxtLink to="/login">
          <UButton>Войти</UButton>
        </NuxtLink>
        <NuxtLink to="/register">
          <UButton variant="outline">Регистрация</UButton>
        </NuxtLink>
      </div>
    </UCard>

    <!-- Загрузка данных о лодке -->
    <div v-if="loading" class="text-center py-8">
      <UProgress animation="carousel" />
      <p class="mt-2 text-gray-500">Загрузка данных о лодке...</p>
    </div>

    <!-- Отображение данных о лодке, бронирования и админ-панель -->
    <template v-else-if="boat">
      <BoatInfo :boat="boat" :user="user" />

      <ClientOnly>
        <BookingCalendar
          v-if="boat.id"
          :boat="boat"
          :user="user"
          :boatId="boat.id"
          @bookingCreated="handleBookingCreated"
        />
      </ClientOnly>
      <!-- <Test /> -->
      <div v-if="(isAdmin || isManager) && boat.id">
        <BookingsManager :boatId="boat.id" @boatUpdated="fetchBoat" />
      </div>
      <!-- <div v-if="(isAdmin || isManager) && boat.id">
        <AdminPanel :boatId="boat.id" @boatUpdated="fetchBoat" />
      </div> -->
    </template>

    <!-- Ошибка: лодка не найдена -->
    <UAlert
      v-else
      title="Лодка не найдена"
      description="Запрошенная лодка не существует или была удалена"
      icon="i-heroicons-exclamation-triangle"
      color="red"
      variant="solid"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BoatInfo from '~/components/BoatInfo.vue'
import BookingCalendar from '~/components/BookingCalendar.vue'

const route = useRoute()
const router = useRouter()
const supabase = useNuxtApp().$supabase
const { $toast: toast } = useNuxtApp()

const slug = computed(() => route.params.slug as string)

const loading = ref(true)
const boat = ref<any>(null)
const user = ref<any>(null)
const isAdmin = ref(false)
const isManager = ref(false)

// 1) Получаем текущего пользователя и профиль
const checkAuth = async () => {
  try {
    const {
      data: { user: authUser },
      error: userErr
    } = await supabase.auth.getUser()
    if (userErr) throw userErr

    if (authUser) {
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()
      if (profErr) throw profErr

      user.value = profile
      isAdmin.value = profile.role === 'admin'
    } else {
      user.value = null
      isAdmin.value = false
    }
  } catch (err: any) {
    console.error('Ошибка проверки авторизации:', err)
    user.value = null
    isAdmin.value = false
  }
}

// 2) Загружаем данные лодки по slug
const fetchBoat = async () => {
  loading.value = true
  try {
    const { data, error } = await supabase
      .from('boats')
      .select('*')
      .eq('slug', slug.value)
      .single()

    if (error || !data) throw error || new Error('Лодка не найдена')
    boat.value = data
  } catch (err: any) {
    console.error('Ошибка загрузки лодки:', err)
    toast.add({ title: 'Ошибка', description: err.message, color: 'red' })
    boat.value = null
  } finally {
    loading.value = false
  }
}

// 3) Проверяем, является ли пользователь менеджером этой лодки
const checkManager = async () => {
  if (!user.value || !boat.value) {
    isManager.value = false
    return
  }
  try {
    console.log('Проверяем менеджера для boat_id=', boat.value.id, 'user_id=', user.value.id)
    const { data, error } = await supabase
      .from('boat_managers')
      .select('user_id')
      .eq('boat_id', boat.value.id)
      .eq('user_id', user.value.id)
      .maybeSingle()
    if (error) throw error
    isManager.value = !!data
    console.log('isManager:', isManager.value)
  } catch (err) {
    console.error('Ошибка проверки менеджера:', err)
    isManager.value = false
  }
}

// 4) Когда и user, и boat получены — проверяем менеджера
watch([user, boat], () => {
  if (user.value && boat.value) {
    checkManager()
  }
})

// Выход из системы
const signOut = async () => {
  try {
    await supabase.auth.signOut()
    user.value = null
    await router.replace('/login')
  } catch (err: any) {
    toast.add({ title: 'Ошибка выхода', description: err.message, color: 'red' })
  }
}

const handleBookingCreated = () => {
  toast.add({ title: 'Бронирование создано!', description: 'Ваше бронирование успешно оформлено', color: 'green' })
  fetchBoat()
}

// Получение профиля пользователя
const getProfile = async () => {
  if (!user.value?.id) return null
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    
    if (error) {
      throw error
    }
    
    return profile
  } catch (error) {
    return null
  }
}

onMounted(async () => {
  await checkAuth()
  await fetchBoat()
  
  if (user.value && boat.value) {
    // Проверяем права менеджера
    const { isManager } = useManager(
      computed(() => user.value?.id ?? null),
      computed(() => boat.value?.id ?? null)
    )
  }
})

definePageMeta({
  validate: async (route) => {
    const s = route.params.slug
    return typeof s === 'string' && /^[a-z0-9-]+$/.test(s)
  }
})
</script>
