<template>
  <div class="p-4">
    <h1 class="text-xl font-bold mb-4">Supabase Test</h1>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <div v-if="error" class="text-red-500">{{ error }}</div>
      <div v-else class="text-green-500">Supabase клиент подключен успешно!</div>
      <pre v-if="debugInfo" class="mt-4 p-4 rounded overflow-auto">{{ debugInfo }}</pre>
    </div>
    <button @click="testSupabase" class="mt-4 text-white px-4 py-2 rounded">
      Проверить Supabase
    </button>
  </div>
</template>

<script setup>
import { useSupabaseClient } from '#imports'

// Получение клиента напрямую через composable из модуля
const supabaseClient = useSupabaseClient()
const loading = ref(false)
const error = ref(null)
const debugInfo = ref(null)

async function testSupabase() {
  loading.value = true
  error.value = null
  debugInfo.value = null
  
  try {
    // Проверка соединения с Supabase через простой запрос ID
    const { data, error: err } = await supabaseClient
      .from('boats')
      .select('id') // Запрашиваем только ID
      .limit(1)
      .maybeSingle() // Используем maybeSingle, так как таблица может быть пустой
    
    if (err) throw err
    
    // Показываем отладочную информацию
    debugInfo.value = JSON.stringify({
      connectionSuccess: true,
      data, // Покажет { id: ... } или null
      clientInfo: {
        url: supabaseClient.supabaseUrl
      }
    }, null, 2)
  } catch (e) {
    console.error('Ошибка при подключении к Supabase:', e)
    error.value = e.message || 'Неизвестная ошибка'
    debugInfo.value = JSON.stringify({
      error: e.message,
      supabaseClient: supabaseClient ? 'определен' : 'не определен',
    }, null, 2)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>

</style>