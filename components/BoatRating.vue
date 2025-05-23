<template>
  <div class="boat-rating flex items-center">
    <span class="flex items-center">
      <UIcon name="i-heroicons-star" class="text-yellow-400 mr-1" />
      <span class="font-medium">{{ formattedRating }}</span>
    </span>
    <span class="text-sm text-gray-500 ml-2">
      ({{ reviewCount }} отзывов)
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useSupabaseClient } from '#imports'

const props = defineProps({
  boatId: {
    type: String,
    required: true
  }
})

const supabaseClient = useSupabaseClient()
const rating = ref(0)
const reviewCount = ref(0)

// Форматированный рейтинг
const formattedRating = computed(() => {
  return rating.value.toFixed(1)
})

// Загрузка рейтинга лодки
const fetchBoatRating = async () => {
  try {
    // Используем правильный запрос, чтобы получить рейтинг из отзывов
    const { data, error } = await supabaseClient.rpc('get_boat_rating', { 
      boat_id: props.boatId 
    })
    
    if (error) throw error
    
    if (data) {
      if (Array.isArray(data) && data.length > 0) {
        rating.value = data[0].avg_rating || 0
        reviewCount.value = data[0].review_count || 0
      } else if (typeof data === 'object') {
        rating.value = data.avg_rating || 0
        reviewCount.value = data.review_count || 0
      }
    }
  } catch (error) {
    console.error('Ошибка при загрузке рейтинга:', error)
  }
}

// Альтернативный способ загрузки рейтингов из отзывов
const fetchRatingsFromReviews = async () => {
  try {
    const { data, error } = await supabaseClient
      .from('reviews')
      .select('rating')
      .eq('boat_id', props.boatId)
    
    if (error) throw error
    
    if (data && data.length > 0) {
      const sum = data.reduce((acc, review) => acc + (review.rating || 0), 0)
      rating.value = data.length > 0 ? sum / data.length : 0
      reviewCount.value = data.length
    }
  } catch (error) {
    console.error('Ошибка при загрузке отзывов:', error)
  }
}

// Загружаем рейтинг при монтировании
onMounted(async () => {
  try {
    await fetchBoatRating()
    
    // Если первый метод не сработал, пробуем альтернативный
    if (rating.value === 0 && reviewCount.value === 0) {
      await fetchRatingsFromReviews()
    }
  } catch (error) {
    console.error('Не удалось загрузить рейтинг:', error)
  }
})
</script> 