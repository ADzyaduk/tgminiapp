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

            <!-- Button Troubleshooting -->
            <UCard>
                <template #header>
                    <h2 class="text-xl font-semibold">Проверка инлайн-кнопок</h2>
                </template>

                <div class="space-y-4 text-sm text-gray-700">
                    <p>
                        Чтобы протестировать подтверждение/отмену бронирований, отправьте реальное уведомление менеджеру
                        или админу. Для этого создайте бронирование в приложении и убедитесь, что у менеджера заполнен
                        Telegram ID.
                    </p>
                    <ol class="list-decimal list-inside space-y-2">
                        <li>Создайте бронирование (обычное или групповое) в административной панели.</li>
                        <li>Проверьте, что уведомление пришло в Telegram с кнопками «Подтвердить» и «Отменить».</li>
                        <li>Нажмите кнопку и убедитесь, что статус обновился в UI и в базе данных.</li>
                        <li>Если кнопки не работают, включите fallback через переменную <code>TELEGRAM_USE_APP_LINKS=true</code>.</li>
                    </ol>
                    <p>
                        Все ошибки теперь доступны в логах сервера (pm2 / docker / терминал). Подробная инструкция —
                        в файле <code>docs/telegram.md</code>.
                    </p>
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
                            <strong>Создайте бронирование:</strong> вручную или через Mini App и дождитесь уведомления
                            в Telegram
                        </li>
                        <li>
                            <strong>Тестируйте кнопки:</strong> в полученном сообщении нажмите "Подтвердить" или
                            "Отменить" и проверьте, что статус обновился
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
const results = ref<Array<{
    action: string
    message: string
    success: boolean
    details?: string
}>>([])

const isSettingWebhook = ref(false)
const isGettingInfo = ref(false)

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
