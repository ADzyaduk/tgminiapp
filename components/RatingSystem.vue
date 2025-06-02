<template>
    <div class="space-y-6">
        <!-- Секция оценок и рейтинга -->
        <div class="rounded-lg shadow-sm p-4">
            <h2 class="text-xl font-semibold mb-4">Отзывы и оценки</h2>

            <!-- Общий рейтинг -->
            <div class="flex items-center gap-4 mb-6">
                <div class="text-4xl font-bold">{{ averageRating }}</div>
                <div class="flex-1">
                    <div class="flex items-center">
                        <template v-for="star in 5" :key="star">
                            <UIcon
                                :name="star <= Math.round(parseFloat(averageRating)) ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                                class="w-5 h-5"
                                :class="star <= Math.round(parseFloat(averageRating)) ? 'text-yellow-400' : 'text-gray-300'" />
                        </template>
                        <span class="ml-2 text-sm text-gray-500">{{ totalReviews }} отзывов</span>
                    </div>

                    <!-- Распределение оценок -->
                    <div class="mt-2 space-y-1">
                        <div v-for="i in 5" :key="i" class="flex items-center text-sm">
                            <span class="w-3">{{ 6 - i }}</span>
                            <div class="mx-2 flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div class="h-full transition-all duration-300 rounded-full" :style="{
                                    width: getRatingPercentage(6 - i) + '%',
                                    backgroundColor: getRatingColor(6 - i) === 'success' ? '#10b981' :
                                        getRatingColor(6 - i) === 'warning' ? '#f59e0b' : '#ef4444'
                                }">
                                </div>
                            </div>
                            <span class="w-8 text-right text-gray-500">{{ getRatingCount(6 - i) }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Форма для добавления отзыва -->
            <div v-if="canSubmitReview" class="border-t pt-4">
                <h3 class="font-medium mb-2">Оставить отзыв</h3>
                <div class="mb-3">
                    <div class="flex items-center gap-1">
                        <template v-for="star in 5" :key="star">
                            <UButton variant="ghost" color="neutral"
                                :icon="star <= newRating ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                                :class="star <= newRating ? 'text-yellow-400' : 'text-gray-300'"
                                @click="newRating = star" />
                        </template>
                        <span class="ml-1 text-sm" v-if="newRating > 0">
                            {{ ratingLabels[newRating - 1] }}
                        </span>
                    </div>
                </div>

                <UTextarea v-model="newReviewText" placeholder="Поделитесь вашими впечатлениями..." :rows="3"
                    class="mb-3 w-full" />

                <div class="flex justify-end">
                    <UButton color="primary" @click="submitReview" :loading="isSubmitting"
                        :disabled="newRating === 0 || isSubmitting">
                        Опубликовать отзыв
                    </UButton>
                </div>
            </div>
        </div>

        <!-- Список отзывов -->
        <div v-if="reviews.length > 0" class="space-y-4">
            <div v-for="review in reviews" :key="review.id" class="rounded-lg shadow-sm p-4">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-2">
                        <UAvatar :src="review.user?.avatar || null" :alt="review.user?.name || 'Пользователь'"
                            size="sm" />
                        <div>
                            <div class="font-medium">{{ review.user?.name || 'Пользователь' }}</div>
                            <div class="text-xs text-gray-500">{{ formatDate(review.createdAt) }}</div>
                        </div>
                    </div>
                    <div class="flex">
                        <template v-for="star in 5" :key="star">
                            <UIcon :name="star <= review.rating ? 'i-heroicons-star-solid' : 'i-heroicons-star'"
                                class="w-4 h-4" :class="star <= review.rating ? 'text-yellow-400' : 'text-gray-300'" />
                        </template>
                    </div>
                </div>

                <p class="text-sm text-gray-700">{{ review.text }}</p>

                <!-- Ответ от администратора -->
                <div v-if="review.response" class="mt-3 pl-4 border-l-2 border-gray-200">
                    <div class="text-xs font-medium text-gray-500 mb-1">Ответ администратора:</div>
                    <p class="text-sm text-gray-700">{{ review.response }}</p>
                </div>

                <!-- Кнопка ответа для админов и менеджеров -->
                <div v-if="canRespondToReviews && !review.response" class="mt-2">
                    <UButton size="xs" variant="ghost" color="neutral"
                        @click="review.showResponseForm = !review.showResponseForm">
                        Ответить
                    </UButton>
                    <div v-if="review.showResponseForm" class="mt-2">
                        <UTextarea v-model="review.responseText" placeholder="Ваш ответ..." :rows="2" class="mb-2" />
                        <div class="flex justify-end gap-2">
                            <UButton size="sm" variant="ghost" color="neutral" @click="review.showResponseForm = false">
                                Отмена
                            </UButton>
                            <UButton size="sm" color="primary" @click="submitResponse(review)"
                                :loading="review.isSubmittingResponse">
                                Отправить
                            </UButton>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Пагинация -->
        <div v-if="showPagination" class="flex justify-center">
            <UPagination v-model="currentPage" :total="totalPages" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabaseClient } from '#imports'
import { useNotificationStore } from '~/stores/useNotificationStore'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale/ru'

const props = defineProps<{
    boatId: string
    ownerUserId?: string
}>()

// Используем новую Telegram авторизацию
const { profile, isAuthenticated } = useTelegramAuth()
const isAdmin = computed(() => profile.value?.role === 'admin')

const supabase = useSupabaseClient()
const notificationStore = useNotificationStore()

// Состояние
const reviews = ref<any[]>([])
const ratingCounts = ref<Record<number, number>>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0
})
const isLoading = ref(false)
const isSubmitting = ref(false)

// Пагинация
const totalReviews = ref(0)
const currentPage = ref(1)
const pageSize = 5
const totalPages = computed(() => Math.ceil(totalReviews.value / pageSize))
const showPagination = computed(() => totalPages.value > 1)

// Данные для нового отзыва
const newRating = ref(0)
const newReviewText = ref('')
const hasSubmittedReview = ref(false)
const ratingLabels = ['Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично']

// Средний рейтинг
const averageRating = computed(() => {
    const total = Object.entries(ratingCounts.value).reduce(
        (sum, [rating, count]) => sum + (Number(rating) * count),
        0
    )
    const count = Object.values(ratingCounts.value).reduce((sum, count) => sum + count, 0)
    return count > 0 ? (total / count).toFixed(1) : '0.0'
})

// Функции для статистики
const getRatingCount = (rating: number) => {
    return ratingCounts.value[rating] || 0
}

const getRatingPercentage = (rating: number) => {
    const count = getRatingCount(rating)
    const total = Object.values(ratingCounts.value).reduce((sum, count) => sum + count, 0)
    return total > 0 ? (count / total) * 100 : 0
}

const getRatingColor = (rating: number): 'success' | 'warning' | 'error' => {
    if (rating >= 4) return 'success'
    if (rating >= 3) return 'warning'
    return 'error'
}

// Проверяем, может ли пользователь оставить отзыв
const canSubmitReview = computed(() => {
    if (!profile.value) return false
    // Проверяем, не принадлежит ли лодка пользователю
    if (props.ownerUserId && String(profile.value.id) === props.ownerUserId) return false
    // Проверяем, не оставил ли уже отзыв
    return !hasSubmittedReview.value
})

// Проверяем, может ли пользователь отвечать на отзывы (владелец или админ)
const canRespondToReviews = computed(() => {
    if (!profile.value) return false
    return isAdmin.value || (props.ownerUserId && String(profile.value.id) === props.ownerUserId)
})

// Загрузка статистики рейтингов
const fetchRatingStats = async () => {
    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('rating')
            .eq('boat_id', props.boatId)

        if (error) {
            console.error('Error fetching rating stats:', error)
            return
        }

        // Сбрасываем счетчики
        ratingCounts.value = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }

        // Подсчитываем рейтинги
        if (data) {
            data.forEach((review: any) => {
                if (review.rating >= 1 && review.rating <= 5) {
                    ratingCounts.value[review.rating]++
                }
            })
        }
    } catch (err) {
        console.error('Error fetching rating stats:', err)
    }
}

// Загрузка при инициализации
onMounted(async () => {
    await checkUserReview()
    await fetchRatingStats()
    await fetchReviews(true)
})

// Функция для получения отзывов (упрощенная)
const fetchReviews = async (resetPage = false) => {
    if (resetPage) {
        currentPage.value = 1
    }

    isLoading.value = true

    try {
        // Получаем страницу отзывов
        const from = (currentPage.value - 1) * pageSize
        const to = from + pageSize - 1

        const { data, count } = await supabase
            .from('reviews')
            .select(`
        id, text, rating, response, created_at, user_id,
        profiles:user_id (
          id, name, avatar
        )
      `, { count: 'exact' })
            .eq('boat_id', props.boatId)
            .order('created_at', { ascending: false })
            .range(from, to)

        if (data) {
            reviews.value = data.map((review: any) => ({
                id: review.id,
                text: review.text,
                rating: review.rating,
                response: review.response,
                createdAt: review.created_at,
                userId: review.user_id,
                user: {
                    id: review.profiles?.id,
                    name: review.profiles?.name,
                    avatar: review.profiles?.avatar
                },
                showResponseForm: false,
                responseText: '',
                isSubmittingResponse: false
            }))
        }

        if (count !== null) {
            totalReviews.value = count
        }

        // Обновляем данные
        await fetchRatingStats()
    } catch (err) {
        console.error('Error fetching reviews:', err)
    } finally {
        isLoading.value = false
    }
}

// Проверка, оставил ли пользователь уже отзыв
const checkUserReview = async () => {
    if (!profile.value?.id) return

    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('id')
            .eq('boat_id', props.boatId)
            .eq('user_id', String(profile.value.id))

        if (error) {
            console.error('Error checking user review:', error)
            hasSubmittedReview.value = false
            return
        }

        hasSubmittedReview.value = data && data.length > 0
    } catch (err) {
        console.error('Error checking user review:', err)
        hasSubmittedReview.value = false
    }
}

// Функция отправки отзыва
const submitReview = async () => {
    if (!profile.value?.id || newRating.value === 0) return

    isSubmitting.value = true

    try {
        const { data, error } = await supabase
            .from('reviews')
            .insert({
                boat_id: props.boatId,
                user_id: String(profile.value.id),
                rating: newRating.value,
                text: newReviewText.value
            })
            .select()
            .single()

        if (error) throw error

        // Обновляем отображение
        hasSubmittedReview.value = true
        newRating.value = 0
        newReviewText.value = ''

        // Обновляем данные
        await fetchReviews(true)

        // Отправляем уведомление владельцу лодки
        if (props.ownerUserId && data) {
            await notificationStore.sendNotification(
                props.ownerUserId,
                `Новый отзыв: ${newRating.value} звезд для лодки`,
                'info',
                { boat_id: props.boatId, review_id: data.id }
            )
        }
    } catch (err) {
        console.error('Error submitting review:', err)
    } finally {
        isSubmitting.value = false
    }
}

// Функция ответа на отзыв
const submitResponse = async (review: any) => {
    if (!profile.value?.id) return

    review.isSubmittingResponse = true

    try {
        const { data, error } = await supabase
            .from('reviews')
            .update({
                response: review.responseText
            })
            .eq('id', review.id)
            .select()
            .single()

        if (error) throw error

        // Обновляем отображение
        review.response = review.responseText
        review.showResponseForm = false
        review.responseText = ''

        // Отправляем уведомление автору отзыва
        await notificationStore.sendNotification(
            review.userId,
            'Получен ответ на ваш отзыв',
            'info',
            { boat_id: props.boatId, review_id: review.id }
        )
    } catch (err) {
        console.error('Error submitting response:', err)
    } finally {
        review.isSubmittingResponse = false
    }
}

// Форматирование даты
const formatDate = (dateString: string) => {
    try {
        return format(new Date(dateString), 'dd MMMM yyyy', { locale: ru })
    } catch (error) {
        return dateString
    }
}

// Следим за изменением ID лодки
watch(() => props.boatId, async () => {
    await checkUserReview()
    await fetchRatingStats()
    await fetchReviews(true)
}, { immediate: false })
</script>
