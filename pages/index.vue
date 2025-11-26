<template>
  <div class="container mx-auto p-4">
    <!-- Заголовок -->
    <div class="flex justify-between items-center mb-4 animate-fade-in-down">
      <h1 class="text-2xl font-bold">BoatRent</h1>
    </div>

    <!-- Навигация по вкладкам с UTabs -->
    <UTabs v-model="activeTab" :items="tabItems" class="w-full mb-6">
      <template #content="{ item }">
        <!-- Контент вкладки "Аренда лодок" -->
        <div v-if="item.id === 'boats'">
          <!-- Поиск -->
          <div class="mb-6 flex flex-col sm:flex-row gap-4 items-center animate-fade-in">
            <UInput
              v-model="searchQuery"
              placeholder="Поиск по названию..."
              icon="i-heroicons-magnifying-glass"
              class="flex-grow max-w-md"
            />
          </div>

          <!-- Загрузка -->
          <div v-if="isLoading" class="space-y-4">
            <USkeleton v-for="n in 3" :key="n" class="h-64 rounded-lg" />
          </div>

          <!-- Ошибка -->
          <UAlert
            v-else-if="errorMessage"
            title="Ошибка загрузки"
            :description="errorMessage"
            icon="i-heroicons-exclamation-triangle"
            variant="solid"
            class="mb-4"
          />

          <!-- Сетка лодок -->
          <div v-else class="space-y-6">
            <TransitionGroup
              v-if="filteredBoats.length"
              name="list"
              tag="div"
              class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <UCard
                v-for="boat in filteredBoats"
                :key="boat.id"
                class="transition-transform duration-300 hover:shadow-lg"
                @click="navigateToBoat(boat)"
              >
                <template #header>
                  <div class="flex items-center gap-4 p-4">
                    <UAvatar :src="getBoatImage(boat)" :alt="boat.name || 'Лодка'" size="lg" class="flex-shrink-0" />
                    <div>
                      <h3 class="text-lg font-bold truncate">{{ boat.name || 'Без названия' }}</h3>
                      <!-- Рейтинг -->
                      <div class="mt-1 flex items-center gap-2 text-sm">
                        <div class="flex">
                          <template v-for="star in 5" :key="star">
                            <UIcon
                              :name="star <= Math.round(boat.averageRating || 0) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                              class="w-4 h-4"
                              :class="star <= Math.round(boat.averageRating || 0) ? 'text-warning' : ''"
                            />
                          </template>
                        </div>
                        <span v-if="boat.totalReviews > 0" class="ml-1 font-medium">
                          {{ parseFloat(boat.averageRating).toFixed(1) }}
                          <span class="text-muted">({{ boat.totalReviews }} {{ reviewTextPlural(boat.totalReviews) }})</span>
                        </span>
                        <span v-else class="ml-1 text-muted">Нет отзывов</span>
                      </div>

                      <div v-if="boat.tags?.length" class="flex flex-wrap gap-2 mt-2">
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

                <div class="p-4">
                  <div class="grid grid-cols-1 gap-4">
                    <!-- Основное изображение -->
                    <div class="relative h-48 rounded-lg overflow-hidden" :class="boat.slug?.toLowerCase() === 'volna' ? 'bg-gray-100 dark:bg-gray-800' : ''">
                      <img
                        :src="getBoatImage(boat)"
                        :alt="boat.name || 'Фото лодки'"
                        :class="[
                          'w-full h-full',
                          boat.slug?.toLowerCase() === 'volna' ? 'object-contain' : 'object-cover'
                        ]"
                        loading="lazy"
                      />
                    </div>

                    <!-- Цена и детали -->
                    <div class="space-y-3">
                      <div>
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            <UIcon name="i-heroicons-currency-dollar" color="primary" />
                            <span>Цена за час:</span>
                          </div>
                          <span class="font-medium text-lg text-primary">{{ formatPrice(boat.price) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </UCard>
            </TransitionGroup>

            <!-- Пустой результат -->
            <div v-else class="text-center py-8">
              <UIcon name="i-lucide-anchor" class="w-12 h-12 mx-auto mb-4" />
              <p class="text-xl">Лодок не найдено</p>
              <p v-if="searchQuery" class="text-sm mt-2">
                По запросу "{{ searchQuery }}" ничего не найдено
              </p>
            </div>
          </div>
        </div>

        <!-- Контент вкладки "Групповые поездки" -->
        <div v-else-if="item.id === 'groups'">
          <ClientOnly>
            <GroupTripList />
          </ClientOnly>
        </div>
      </template>
    </UTabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSupabaseClient } from '#imports'
import { useRouter } from 'vue-router'
import { useBoatImages } from '~/composables/useBoatImages'
import GroupTripList from '~/components/GroupTripList.vue'

definePageMeta({
  layout: 'default'
})

// Supabase клиент
const supabaseClient = useSupabaseClient()
const router = useRouter()

// Состояния
const boats = ref<any[]>([])
const isLoading = ref(true)
const errorMessage = ref<string | null>(null)
const searchQuery = ref('')

// Навигация и вкладки
const activeTab = ref('boats')
const tabs = [
  { id: 'boats', name: 'Аренда лодок', icon: 'i-lucide-anchor' },
  { id: 'groups', name: 'Групповые поездки', icon: 'i-heroicons-user-group' }
]

// Преобразуем массив tabs в формат, ожидаемый UTabs компонентом
const tabItems = computed(() =>
  tabs.map(tab => ({
    label: tab.name,
    icon: tab.icon,
    value: tab.id,
    id: tab.id
  }))
)

// Фильтрация лодок по названию
const filteredBoats = computed(() =>
  boats.value.filter(b =>
    b.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    (b.description && b.description.toLowerCase().includes(searchQuery.value.toLowerCase()))
  )
)

// Загрузка лодок
async function fetchBoats() {
  try {
    // Запрос лодок с данными об отзывах
    // Модуль @nuxtjs/supabase автоматически использует переменные из process.env
    const { data, error } = await supabaseClient
      .from('boats')
      .select('*, reviews(*)')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Обработка данных и добавление информации о рейтинге
    boats.value = (data || []).map((boat: any) => {
      // Рассчитываем средний рейтинг для лодки
      const reviews = boat.reviews || [];
      let averageRating = 0;
      let totalReviews = 0;

      if (reviews.length > 0) {
        const sum = reviews.reduce((acc: number, review: any) => acc + (review.rating || 0), 0);
        averageRating = sum / reviews.length;
        totalReviews = reviews.length;
      }

      // Создаем новый объект с дополнительными полями
      const boatWithRating = {
        ...boat,
        averageRating,
        totalReviews
      };

      // Удаляем полные данные отзывов, чтобы не перегружать объект
      delete boatWithRating.reviews;

      return boatWithRating;
    });

  } catch (err: any) {
    console.error('Error loading boats:', err)
    errorMessage.value = err.message || 'Не удалось загрузить лодки'
  }
}

// Форматирование
const formatPrice = (price: number) => {
  return `${price.toLocaleString('ru-RU')} ₽`
}

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

// Переходы
function navigateToBoat(boat: any) {
  router.push(`/boats/${boat.slug}`)
}

// Получение изображения лодки
function getBoatImage(boat: any) {
  if (boat.slug) {
    const { primary } = useBoatImages(boat);
    if (primary.value) return primary.value;
  }

  // Запасной вариант - если есть массив images в данных лодки
  if (boat.images && boat.images.length > 0) {
    return boat.images[0];
  }

  return '/images/default-boat.jpg';
}

// Загрузка данных при монтировании
onMounted(async () => {
  isLoading.value = true
  try {
    await fetchBoats()
    errorMessage.value = null
  } catch (err: any) {
    errorMessage.value = 'Произошла ошибка при загрузке данных'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.animate-fade-in-down {
  animation: fadeInDown 0.5s ease-out;
}

@keyframes fadeInDown {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
