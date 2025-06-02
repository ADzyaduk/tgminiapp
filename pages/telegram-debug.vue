<template>
    <div class="min-h-screen bg-gray-50 p-4">
        <UCard class="max-w-4xl mx-auto">
            <template #header>
                <h1 class="text-2xl font-bold">🔍 Telegram Debug Console</h1>
            </template>

            <div class="space-y-6">
                <!-- Основная информация -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <UCard>
                        <template #header>
                            <h3 class="font-bold">📱 Telegram WebApp Status</h3>
                        </template>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span>Telegram Object:</span>
                                <span class="font-mono" :class="telegramExists ? 'text-green-600' : 'text-red-600'">
                                    {{ telegramExists ? '✅ Available' : '❌ Not Found' }}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>WebApp Object:</span>
                                <span class="font-mono" :class="webAppExists ? 'text-green-600' : 'text-red-600'">
                                    {{ webAppExists ? '✅ Available' : '❌ Not Found' }}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>Init Data:</span>
                                <span class="font-mono" :class="hasInitData ? 'text-green-600' : 'text-red-600'">
                                    {{ hasInitData ? '✅ Available' : '❌ Empty' }}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>Environment:</span>
                                <span class="font-mono">{{ environment }}</span>
                            </div>
                        </div>
                    </UCard>

                    <UCard>
                        <template #header>
                            <h3 class="font-bold">🌐 Connection Info</h3>
                        </template>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span>Protocol:</span>
                                <span class="font-mono" :class="isHttps ? 'text-green-600' : 'text-red-600'">
                                    {{ protocol }}
                                </span>
                            </div>
                            <div class="flex justify-between">
                                <span>Host:</span>
                                <span class="font-mono">{{ host }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span>User Agent:</span>
                                <span class="font-mono text-xs">{{ isTelegramBrowser ? '✅ Telegram' : '❌ Not Telegram'
                                }}</span>
                            </div>
                        </div>
                    </UCard>
                </div>

                <!-- Init Data Details -->
                <UCard v-if="initDataRaw">
                    <template #header>
                        <h3 class="font-bold">📄 Init Data Details</h3>
                    </template>
                    <div class="space-y-3">
                        <div>
                            <label class="text-sm font-medium text-gray-700">Raw Init Data:</label>
                            <textarea v-model="initDataRaw" class="w-full mt-1 p-2 border rounded text-xs font-mono"
                                rows="3" readonly />
                        </div>
                        <div v-if="parsedInitData">
                            <label class="text-sm font-medium text-gray-700">Parsed Data:</label>
                            <pre class="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">{{ JSON.stringify(parsedInitData, null,
                                2) }}</pre>
                        </div>
                    </div>
                </UCard>

                <!-- Error Info -->
                <UCard v-if="lastError" color="red">
                    <template #header>
                        <h3 class="font-bold text-red-600">❌ Last Error</h3>
                    </template>
                    <div class="space-y-2">
                        <p class="text-sm text-red-800">{{ lastError }}</p>
                        <p class="text-xs text-red-600">{{ lastErrorTime }}</p>
                    </div>
                </UCard>

                <!-- Actions -->
                <div class="flex flex-wrap gap-3">
                    <UButton @click="testTelegramAuth" :loading="testing" color="primary">
                        🧪 Test Auth
                    </UButton>
                    <UButton @click="refreshData" variant="soft">
                        🔄 Refresh Data
                    </UButton>
                    <UButton @click="copyDebugInfo" variant="soft" color="neutral">
                        📋 Copy Debug Info
                    </UButton>
                </div>

                <!-- Troubleshooting -->
                <UCard>
                    <template #header>
                        <h3 class="font-bold">🛠️ Troubleshooting</h3>
                    </template>
                    <div class="space-y-4 text-sm">
                        <div v-if="!telegramExists" class="p-3 bg-red-50 border border-red-200 rounded">
                            <h4 class="font-bold text-red-800">❌ Telegram Object Not Found</h4>
                            <ul class="mt-2 space-y-1 text-red-700">
                                <li>• Убедитесь, что страница открыта через Telegram Mini App</li>
                                <li>• Проверьте подключение скрипта Telegram WebApp</li>
                                <li>• Добавьте в head: &lt;script
                                    src="https://telegram.org/js/telegram-web-app.js"&gt;&lt;/script&gt;</li>
                            </ul>
                        </div>

                        <div v-if="!isHttps && environment === 'production'"
                            class="p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <h4 class="font-bold text-yellow-800">⚠️ HTTPS Required</h4>
                            <p class="mt-2 text-yellow-700">
                                Telegram Mini Apps требуют HTTPS в production. Настройте SSL сертификат.
                            </p>
                        </div>

                        <div v-if="!isTelegramBrowser" class="p-3 bg-blue-50 border border-blue-200 rounded">
                            <h4 class="font-bold text-blue-800">ℹ️ Not in Telegram Browser</h4>
                            <p class="mt-2 text-blue-700">
                                Страница открыта не в Telegram. Откройте её через бота или Mini App.
                            </p>
                        </div>
                    </div>
                </UCard>
            </div>
        </UCard>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    layout: false,
    title: 'Telegram Debug'
})

const { getTelegramInitData, parseInitData } = useTelegramAuth()
const toast = useToast()

// Reactive data
const testing = ref(false)
const lastError = ref('')
const lastErrorTime = ref('')

// Computed properties
const telegramExists = computed(() => {
    if (typeof window === 'undefined') return false
    return !!window.Telegram
})

const webAppExists = computed(() => {
    if (typeof window === 'undefined') return false
    return !!window.Telegram?.WebApp
})

const initDataRaw = computed(() => {
    if (typeof window === 'undefined') return ''
    return getTelegramInitData()
})

const hasInitData = computed(() => {
    return !!initDataRaw.value
})

const parsedInitData = computed(() => {
    if (!initDataRaw.value) return null
    return parseInitData(initDataRaw.value)
})

const environment = computed(() => {
    const config = useRuntimeConfig()
    return config.public.isTelegramDevMode ? 'development' : 'production'
})

const protocol = computed(() => {
    if (typeof window === 'undefined') return 'unknown'
    return window.location.protocol
})

const host = computed(() => {
    if (typeof window === 'undefined') return 'unknown'
    return window.location.host
})

const isHttps = computed(() => {
    return protocol.value === 'https:'
})

const isTelegramBrowser = computed(() => {
    if (typeof window === 'undefined') return false
    const userAgent = navigator.userAgent.toLowerCase()
    return userAgent.includes('telegram')
})

// Methods
const testTelegramAuth = async () => {
    try {
        testing.value = true
        lastError.value = ''

        const { signInWithTelegram } = useTelegramAuth()
        const result = await signInWithTelegram()

        if (result.success) {
            toast.add({
                title: 'Success!',
                description: 'Authentication test passed',
                color: 'success'
            })
        } else {
            throw new Error(result.error || 'Authentication failed')
        }
    } catch (error: any) {
        lastError.value = error.message
        lastErrorTime.value = new Date().toLocaleString()

        toast.add({
            title: 'Test Failed',
            description: error.message,
            color: 'error'
        })
    } finally {
        testing.value = false
    }
}

const refreshData = () => {
    // Trigger reactivity update
    nextTick(() => {
        toast.add({
            title: 'Refreshed',
            description: 'Debug data updated',
            color: 'info'
        })
    })
}

const copyDebugInfo = async () => {
    const debugInfo = {
        telegram_exists: telegramExists.value,
        webapp_exists: webAppExists.value,
        has_init_data: hasInitData.value,
        environment: environment.value,
        protocol: protocol.value,
        host: host.value,
        is_https: isHttps.value,
        is_telegram_browser: isTelegramBrowser.value,
        init_data_length: initDataRaw.value?.length || 0,
        user_agent: typeof window !== 'undefined' ? navigator.userAgent : 'unknown',
        parsed_data: parsedInitData.value,
        last_error: lastError.value
    }

    try {
        await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
        toast.add({
            title: 'Copied!',
            description: 'Debug info copied to clipboard',
            color: 'success'
        })
    } catch (error) {
        console.error('Failed to copy:', error)
        toast.add({
            title: 'Copy Failed',
            description: 'Could not copy to clipboard',
            color: 'error'
        })
    }
}
</script>
