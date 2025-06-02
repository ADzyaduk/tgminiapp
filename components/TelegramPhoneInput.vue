<template>
    <UCard v-if="showPhoneInput" class="w-full max-w-md mx-auto">
        <template #header>
            <h2 class="text-xl font-bold text-center">📞 Укажите номер телефона</h2>
        </template>

        <div class="space-y-4">
            <p class="text-sm text-gray-600 text-center">
                Для завершения бронирования нам нужен ваш номер телефона
            </p>

            <form @submit.prevent="handleSubmit" class="space-y-4">
                <UFormField label="Номер телефона" :error="error" required>
                    <UInput v-model="phone" type="tel" placeholder="+7 (XXX) XXX-XX-XX" icon="i-heroicons-phone"
                        autocomplete="tel" maxlength="18" @input="formatPhone" />
                </UFormField>

                <UButton type="submit" block :loading="loading" :disabled="loading || !isValidPhone">
                    Сохранить номер
                </UButton>

                <UButton variant="ghost" block @click="$emit('skip')" :disabled="loading">
                    Пропустить (можно ввести позже)
                </UButton>
            </form>
        </div>
    </UCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToast } from '#imports'

interface Props {
    showPhoneInput: boolean
}

interface Emits {
    (e: 'success', phone: string): void
    (e: 'skip'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { updatePhone } = useTelegramAuth()
const toast = useToast()

const phone = ref('')
const loading = ref(false)
const error = ref('')

// Валидация номера телефона
const isValidPhone = computed(() => {
    const cleaned = phone.value.replace(/\D/g, '')
    return cleaned.length === 11 && cleaned.startsWith('7')
})

// Форматирование номера телефона
const formatPhone = (event: Event) => {
    const input = event.target as HTMLInputElement
    const value = input.value.replace(/\D/g, '')

    let formatted = ''

    if (value.length > 0) {
        if (value.startsWith('8')) {
            formatted = '+7'
            const rest = value.substring(1)
            if (rest.length > 0) formatted += ` (${rest.substring(0, 3)}`
            if (rest.length > 3) formatted += `) ${rest.substring(3, 6)}`
            if (rest.length > 6) formatted += `-${rest.substring(6, 8)}`
            if (rest.length > 8) formatted += `-${rest.substring(8, 10)}`
        } else if (value.startsWith('7')) {
            formatted = `+${value.substring(0, 1)}`
            const rest = value.substring(1)
            if (rest.length > 0) formatted += ` (${rest.substring(0, 3)}`
            if (rest.length > 3) formatted += `) ${rest.substring(3, 6)}`
            if (rest.length > 6) formatted += `-${rest.substring(6, 8)}`
            if (rest.length > 8) formatted += `-${rest.substring(8, 10)}`
        } else {
            formatted = `+7 (${value.substring(0, 3)}`
            if (value.length > 3) formatted += `) ${value.substring(3, 6)}`
            if (value.length > 6) formatted += `-${value.substring(6, 8)}`
            if (value.length > 8) formatted += `-${value.substring(8, 10)}`
        }
    }

    phone.value = formatted
}

// Обработка отправки формы
const handleSubmit = async () => {
    try {
        loading.value = true
        error.value = ''

        // Очищаем номер от форматирования
        const cleanPhone = phone.value.replace(/\D/g, '')
        const formattedPhone = `+${cleanPhone}`

        const result = await updatePhone(formattedPhone)

        if (result.success) {
            toast.add({
                title: 'Успешно!',
                description: 'Номер телефона сохранен',
                color: 'success'
            })

            emit('success', formattedPhone)
        } else {
            error.value = result.error || 'Ошибка сохранения номера'
            toast.add({
                title: 'Ошибка',
                description: error.value,
                color: 'error'
            })
        }

    } catch (err: any) {
        error.value = 'Произошла ошибка при сохранении'
        toast.add({
            title: 'Ошибка',
            description: error.value,
            color: 'error'
        })
    } finally {
        loading.value = false
    }
}

// Автоматическое фокусирование при появлении
watch(() => props.showPhoneInput, (show) => {
    if (show) {
        nextTick(() => {
            const input = document.querySelector('input[type="tel"]') as HTMLInputElement
            input?.focus()
        })
    }
})
</script>
