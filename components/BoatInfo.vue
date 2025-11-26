<template>
  <UCard class="mb-6 hover:shadow-lg transition-shadow duration-300">
    <template #header>
      <div class="flex items-center gap-4">
        <UAvatar :src="primaryImage || '/images/default-boat.jpg'" :alt="boat?.name || 'Лодка'" size="xl" />
        <div>
          <h1 class="text-2xl font-bold truncate">{{ boat?.name || 'Без названия' }}</h1>
          <!-- Рейтинг лодки -->
          <div v-if="!isLoadingRating" class="mt-1 flex items-center gap-2 text-sm">
            <div v-if="totalReviews > 0" class="flex items-center">
              <template v-for="star in 5" :key="star">
                <UIcon
                  :name="star <= Math.round(parseFloat(averageRating)) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                  class="w-4 h-4"
                  :class="star <= Math.round(parseFloat(averageRating)) ? 'text-yellow-400' : 'text-muted'"
                />
              </template>
              <span class="ml-1.5 font-medium">{{ averageRating }}</span>
              <span class="ml-1 text-muted">({{ totalReviews }} {{ reviewTextPlural(totalReviews) }})</span>
            </div>
            <div v-else class="text-muted">
              Нет отзывов
            </div>
          </div>
          <div v-else class="mt-1 h-5"> <!-- Placeholder for loading state -->
             <USkeleton class="h-4 w-32" />
          </div>

          <div v-if="boat?.tags?.length" class="flex flex-wrap gap-2 mt-2">
            <UBadge
              v-for="tag in boat.tags"
              :key="tag"
              variant="subtle"
              color="primary"
            >
              {{ tag }}
            </UBadge>
          </div>
        </div>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Галерея -->
      <div class="space-y-2">
        <!-- Основное изображение -->
        <div v-if="primaryImage" class="relative h-64 md:h-72 rounded-lg overflow-hidden group">
          <img
            ref="mainImage"
            :src="currentImage || primaryImage"
            :alt="boat?.name || 'Фото лодки'"
            :class="imageDisplayClass"
            class="w-full h-full transition-all duration-300"
            loading="lazy"
            @load="onImageLoad"
            @click="toggleImageFit"
          />

          <!-- Индикатор режима просмотра и отладочная информация -->
          <div class="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            <div>{{ imageFitMode === 'cover' ? 'Обрезка' : 'Полное' }}</div>
            <div v-if="imageAspectRatio" class="text-xs opacity-75">
              {{ imageAspectRatio.toFixed(2) }}
              {{ imageAspectRatio < 1 ? '📱' : imageAspectRatio > 1.5 ? '🖼️' : '⬜' }}
            </div>
          </div>



          <!-- Кнопка переключения режима -->
          <button
            @click="toggleImageFit"
            class="absolute bottom-2 right-2 bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/90"
            title="Переключить режим отображения"
          >
            <UIcon :name="imageFitMode === 'cover' ? 'i-heroicons-arrows-pointing-out' : 'i-heroicons-arrows-pointing-in'" class="w-4 h-4" />
          </button>
        </div>
        <div v-else class="relative h-64 md:h-72 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
          <UIcon name="i-heroicons-photo" class="text-muted w-16 h-16" />
        </div>

        <!-- Миниатюры галереи, если есть несколько изображений -->
        <div v-if="images.length > 1" class="flex flex-wrap gap-2 overflow-x-auto py-1">
          <div
            v-for="(img, index) in images"
            :key="index"
            class="relative w-16 h-16 rounded-md overflow-hidden cursor-pointer flex-shrink-0 border-2 hover:border-primary-300 transition-colors"
            :class="currentImage === img ? 'border-primary-500' : 'border-transparent'"
            @click="selectThumbnail(img)"
          >
            <img
              :src="img"
              :alt="`${boat?.name} фото ${index + 1}`"
              class="w-full h-full object-cover hover:scale-105 transition-transform"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      <!-- Pricing & Specs -->
      <div class="space-y-4">
        <!-- Цены -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-currency-dollar" />
            <h3 class="text-lg font-semibold">Стоимость аренды</h3>
          </div>
          <div class="pl-7">
            <div class="flex justify-between items-center">
              <span>Цена за час:</span>
              <span class="font-medium text-lg" :class="{'text-primary-600': isAgentOrAdmin}">{{ userPrice }} <small>/час</small></span>
            </div>
          </div>
        </div>

        <!-- Specs -->
        <div v-if="hasSpecs" class="pt-4 border-t">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-information-circle" />
            <h3 class="text-lg font-semibold">Характеристики</h3>
          </div>
          <div class="grid grid-cols-2 gap-4 pl-7">
            <div v-for="spec in specs" :key="spec.label" class="flex justify-between">
              <span>{{ spec.label }}:</span>
              <span class="font-medium">{{ spec.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Database } from '~~/types/supabase'
import { useBoatImages } from '~/composables/useBoatImages'
import { useBoatSpecs } from '~/composables/useBoatSpecs'
import { useBoatFormatting } from '~/composables/useBoatFormatting'
import { useImageAnalyzer } from '~/composables/useImageAnalyzer'
import { computed, ref, onMounted, watch } from 'vue'
import { useSupabaseClient } from '#imports'

type BoatRow = Database['public']['Tables']['boats']['Row']
type ReviewRow = Database['public']['Tables']['reviews']['Row']


// Props
const props = defineProps<{
  boat: BoatRow
  user?: any // Используем any чтобы избежать проблем с типами
}>()

// Supabase client
const supabase = useSupabaseClient<Database>()

// Состояние рейтинга
const averageRating = ref('0.0')
const totalReviews = ref(0)
const isLoadingRating = ref(true)

// Состояние
const currentImage = ref<string | null>(null)
// Для лодки "волна" используем contain по умолчанию, чтобы не обрезать изображение
const defaultFitMode = props.boat?.slug?.toLowerCase() === 'volna' ? 'contain' : 'cover'
const imageFitMode = ref<'cover' | 'contain'>(defaultFitMode)
const imageAspectRatio = ref<number | null>(null)
const mainImage = ref<HTMLImageElement | null>(null)

// Composables
const { primary: primaryImage, images } = useBoatImages(props.boat)
const { specs, hasSpecs } = useBoatSpecs(props.boat)
const {
  formattedPrice: format,
} = useBoatFormatting(
  Number(props.boat?.price || 0),
  Number(props.boat?.agent_price || 0)
)
const { formatDebugInfo, recommendDisplayMode, getOptimalPosition } = useImageAnalyzer()

// Computed
const isAgentOrAdmin = computed(() => {
  if (!props.user) return false
  const userRole = props.user.role || props.user.user_metadata?.role
  return ['admin', 'agent', 'manager'].includes(userRole as string)
})

const userPrice = computed(() => {
  // Безопасно извлекаем цены с проверкой на undefined/null
  const regularPrice = Number(props.boat?.price || 0)
  const agentPrice = Number(props.boat?.agent_price || 0)

  const price = isAgentOrAdmin.value ? agentPrice : regularPrice
  return format(price)
})

// Computed для класса отображения изображения
const imageDisplayClass = computed(() => {
  const baseClasses = []

  if (imageFitMode.value === 'contain') {
    baseClasses.push('object-contain')
    // Для contain добавляем фон чтобы не было пустого пространства
    baseClasses.push('bg-gray-100 dark:bg-gray-800')
  } else {
    baseClasses.push('object-cover')

    // Используем анализатор для оптимального позиционирования
    if (imageAspectRatio.value) {
      const debugInfo = formatDebugInfo(
        mainImage.value?.naturalWidth || 0,
        mainImage.value?.naturalHeight || 0
      )
      baseClasses.push(debugInfo.position)
    } else {
      baseClasses.push('object-center')
    }
  }

  baseClasses.push('cursor-pointer')

  return baseClasses.join(' ')
})

// Функция для загрузки рейтинга
async function fetchRatingSummary(boatId: string) {
  if (!boatId) return
  isLoadingRating.value = true
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('boat_id', boatId)

    if (error) throw error

    if (data && data.length > 0) {
      const sum = data.reduce((acc, review) => acc + (review.rating || 0), 0)
      averageRating.value = (sum / data.length).toFixed(1)
      totalReviews.value = data.length
    } else {
      averageRating.value = '0.0'
      totalReviews.value = 0
    }
  } catch (err) {
    console.error('Error fetching rating summary:', err)
    averageRating.value = '0.0'
    totalReviews.value = 0
  } finally {
    isLoadingRating.value = false
  }
}

// Загрузка рейтинга при монтировании и при изменении лодки
onMounted(() => {
  if (props.boat?.id) {
    fetchRatingSummary(props.boat.id)
  }
})

watch(() => props.boat?.id, (newId) => {
  if (newId) {
    fetchRatingSummary(newId)
  }
}, { immediate: true }) // immediate: true to run on initial boat load as well


// Helper for pluralizing review text
function reviewTextPlural(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'отзыв';
  } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return 'отзыва';
  } else {
    return 'отзывов';
  }
}

// Функция для обработки загрузки изображения
function onImageLoad() {
  if (mainImage.value) {
    const { naturalWidth, naturalHeight } = mainImage.value
    imageAspectRatio.value = naturalWidth / naturalHeight

    // Для лодки "волна" всегда используем contain, чтобы не обрезать изображение
    const isVolna = props.boat?.slug?.toLowerCase() === 'volna'
    if (isVolna) {
      imageFitMode.value = 'contain'
    } else {
      // Используем анализатор для автоматического выбора режима для других лодок
      const recommendation = recommendDisplayMode(imageAspectRatio.value)
      imageFitMode.value = recommendation.mode
    }
  }
}

// Функция для переключения режима отображения
function toggleImageFit() {
  imageFitMode.value = imageFitMode.value === 'cover' ? 'contain' : 'cover'
}

// Функция для выбора миниатюры
function selectThumbnail(img: string) {
  currentImage.value = img
}

// Watch для сброса настроек при смене изображения
watch(currentImage, () => {
  // Для лодки "волна" сохраняем contain режим
  const isVolna = props.boat?.slug?.toLowerCase() === 'volna'
  imageFitMode.value = isVolna ? 'contain' : 'cover'
  imageAspectRatio.value = null
}, { immediate: true })

</script>
