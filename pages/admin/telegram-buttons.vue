<template>
    <div class="container mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Тестирование интерактивных кнопок Telegram</h1>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Webhook Setup -->
            <UCard>
                <template #header>
                    <h2 class="text-xl font-semibold">Настройка Webhook</h2>
                </template>

                <div class="space-y-4">
                    <UFormField label="URL для webhook">
                        <UInput v-model="webhookUrl" placeholder="https://yourdomain.com/api/telegram/webhook" />
                    </UFormField>

                    <div class="flex gap-2">
                        <UButton color="primary" :loading="isSettingWebhook" @click="setWebhook">
                            Установить Webhook
                        </UButton>

                        <UButton color="neutral" variant="soft" :loading="isGettingInfo" @click="getWebhookInfo">
                            Проверить Webhook
                        </UButton>
                    </div>

                    <div v-if="webhookInfo" class="mt-4 p-3 bg-gray-50 rounded">
                        <h3 class="font-medium mb-2">Информация о боте и webhook:</h3>
                        <pre class="text-sm">{{ JSON.stringify(webhookInfo, null, 2) }}</pre>
                    </div>
                </div>
            </UCard>

            <!-- Send Test Notification -->
            <UCard>
                <template #header>
                    <h2 class="text-xl font-semibold">Тестовое уведомление с кнопками</h2>
                </template>

                <div class="space-y-4">
                    <UFormField label="Chat ID (ваш Telegram ID)">
                        <UInput v-model="testChatId" placeholder="1396986028" />
                    </UFormField>

                    <UFormField label="Тип бронирования">
                        <USelect v-model="testBookingType" :options="[
                            { label: 'Обычное бронирование', value: 'regular' },
                            { label: 'Групповая поездка', value: 'group_trip' }
                        ]" />
                    </UFormField>

                    <UFormField label="Test Booking ID">
                        <UInput v-model="testBookingId" placeholder="123e4567-e89b-12d3-a456-426614174000" />
                    </UFormField>

                    <UButton color="primary" :loading="isSendingTest" @click="sendTestNotification">
                        Отправить тестовое уведомление
                    </UButton>
                </div>
            </UCard>
        </div>

        <!-- Results -->
        <div v-if="results.length > 0" class="mt-6">
            <UCard>
                <template #header>
                    <h2 class="text-xl font-semibold">Результаты</h2>
                </template>

                <div class="space-y-2">
                    <div v-for="(result, index) in results" :key="index" :class="[
                        'p-3 rounded border-l-4',
                        result.success ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
                    ]">
                        <div class="font-medium">{{ result.action }}</div>
                        <div class="text-sm text-gray-600">{{ result.message }}</div>
                        <div v-if="result.details" class="text-xs text-gray-500 mt-1">
                            {{ result.details }}
                        </div>
                    </div>
                </div>
            </UCard>
        </div>

        <!-- Instructions -->
        <UCard class="mt-6">
            <template #header>
                <h2 class="text-xl font-semibold">Инструкции</h2>
            </template>

            <div class="prose max-w-none">
                <ol class="list-decimal list-inside space-y-2">
                    <li>
                        <strong>Установите webhook:</strong> Введите URL вашего сервера +
                        <code>/api/telegram/webhook</code> и нажмите "Установить Webhook"
                    </li>
                    <li>
                        <strong>Проверьте webhook:</strong> Нажмите "Проверить Webhook" чтобы убедиться,
                        что webhook настроен правильно
                    </li>
                    <li>
                        <strong>Отправьте тестовое уведомление:</strong> Введите ваш Telegram Chat ID
                        и ID существующего бронирования, затем отправьте тест
                    </li>
                    <li>
                        <strong>Тестируйте кнопки:</strong> В полученном сообщении нажмите кнопки
                        "Подтвердить" или "Отменить" и проверьте, что статус обновляется в базе данных
                    </li>
                </ol>

                <div class="mt-4 p-4 bg-blue-50 rounded">
                    <h3 class="font-medium text-blue-900 mb-2">Как найти ваш Chat ID:</h3>
                    <ol class="text-sm text-blue-800 list-decimal list-inside space-y-1">
                        <li>Отправьте любое сообщение вашему боту в Telegram</li>
                        <li>Перейдите по ссылке:
                            <code>https://api.telegram.org/bot&lt;YOUR_BOT_TOKEN&gt;/getUpdates</code>
                        </li>
                        <li>Найдите "chat":{"id": NUMBER} в ответе - это ваш Chat ID</li>
                    </ol>
                </div>
            </div>
        </UCard>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// State
const webhookUrl = ref('')
const webhookInfo = ref(null)
const testChatId = ref('1396986028')
const testBookingId = ref('')
const testBookingType = ref('regular')
const results = ref<Array<{
    action: string
    message: string
    success: boolean
    details?: string
}>>([])

const isSettingWebhook = ref(false)
const isGettingInfo = ref(false)
const isSendingTest = ref(false)

// Methods
const setWebhook = async () => {
    if (!webhookUrl.value) {
        addResult('Установка webhook', 'Не указан URL webhook', false)
        return
    }

    try {
        isSettingWebhook.value = true

        const response: any = await $fetch('/api/telegram/set-webhook', {
            method: 'POST',
            body: { webhook_url: webhookUrl.value }
        })

        if (response.success) {
            addResult('Установка webhook', response.message, true, response.webhook_url)
        } else {
            addResult('Установка webhook', response.error, false, JSON.stringify(response.details))
        }
    } catch (error: any) {
        addResult('Установка webhook', 'Ошибка запроса', false, error.message)
    } finally {
        isSettingWebhook.value = false
    }
}

const getWebhookInfo = async () => {
    try {
        isGettingInfo.value = true

        webhookInfo.value = await $fetch('/api/telegram/webhook-info')
        addResult('Получение информации', 'Информация получена успешно', true)
    } catch (error: any) {
        addResult('Получение информации', 'Ошибка запроса', false, error.message)
    } finally {
        isGettingInfo.value = false
    }
}

const sendTestNotification = async () => {
    if (!testChatId.value || !testBookingId.value) {
        addResult('Тестовое уведомление', 'Не указан Chat ID или Booking ID', false)
        return
    }

    try {
        isSendingTest.value = true

        // Отправляем тестовое уведомление
        const response: any = await $fetch('/api/telegram/test-buttons', {
            method: 'POST',
            body: {
                chat_id: testChatId.value,
                booking_id: testBookingId.value,
                booking_type: testBookingType.value
            }
        })

        if (response.success) {
            addResult('Тестовое уведомление', 'Уведомление отправлено успешно', true)
        } else {
            addResult('Тестовое уведомление', response.error, false)
        }
    } catch (error: any) {
        addResult('Тестовое уведомление', 'Ошибка отправки', false, error.message)
    } finally {
        isSendingTest.value = false
    }
}

const addResult = (action: string, message: string, success: boolean, details?: string) => {
    results.value.unshift({
        action,
        message,
        success,
        details
    })
}

// Auto-detect webhook URL
onMounted(() => {
    if (process.client) {
        webhookUrl.value = `${window.location.origin}/api/telegram/webhook`
    }
})
</script>
