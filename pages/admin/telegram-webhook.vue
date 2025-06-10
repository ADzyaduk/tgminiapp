<template>
    <div class="container mx-auto p-6">
        <h1 class="text-3xl font-bold mb-6">Telegram Webhook Management</h1>

        <!-- Webhook Info -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4">Current Webhook Status</h2>

            <button @click="checkWebhookInfo" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
                :disabled="loading">
                {{ loading ? 'Checking...' : 'Check Webhook Info' }}
            </button>

            <div v-if="webhookInfo" class="bg-gray-100 p-4 rounded">
                <pre>{{ JSON.stringify(webhookInfo, null, 2) }}</pre>
            </div>
        </div>

        <!-- Set Webhook -->
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <h2 class="text-xl font-semibold mb-4">Set Webhook URL</h2>

            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">Webhook URL (must be HTTPS)</label>
                <input v-model="webhookUrl" type="url" placeholder="https://yourdomain.com/api/telegram/webhook"
                    class="w-full border border-gray-300 rounded px-3 py-2" />
                <p class="text-sm text-gray-600 mt-1">
                    Для разработки используйте ngrok: <code>ngrok http 3001</code>
                </p>
            </div>

            <button @click="setWebhook" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                :disabled="loading || !webhookUrl">
                {{ loading ? 'Setting...' : 'Set Webhook' }}
            </button>

            <div v-if="setResult" class="mt-4 bg-gray-100 p-4 rounded">
                <pre>{{ JSON.stringify(setResult, null, 2) }}</pre>
            </div>
        </div>

        <!-- Test Notifications -->
        <div class="bg-white rounded-lg shadow p-6">
            <h2 class="text-xl font-semibold mb-4">Test Notification</h2>

            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">Notification Type</label>
                <select v-model="testType" class="w-full border border-gray-300 rounded px-3 py-2">
                    <option value="new_booking">New Booking</option>
                    <option value="status_change">Status Change</option>
                    <option value="reminder">Reminder</option>
                </select>
            </div>

            <button @click="sendTestNotification" class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                :disabled="loading">
                {{ loading ? 'Sending...' : 'Send Test Notification' }}
            </button>

            <div v-if="testResult" class="mt-4 bg-gray-100 p-4 rounded">
                <pre>{{ JSON.stringify(testResult, null, 2) }}</pre>
            </div>
        </div>

        <!-- Messages -->
        <div v-if="message" class="mt-6 p-4 rounded" :class="messageClass">
            {{ message }}
        </div>
    </div>
</template>

<script setup>
const webhookUrl = ref('')
const webhookInfo = ref(null)
const setResult = ref(null)
const testResult = ref(null)
const testType = ref('new_booking')
const loading = ref(false)
const message = ref('')
const messageClass = ref('')

async function checkWebhookInfo() {
    loading.value = true
    try {
        const { data } = await $fetch('/api/telegram/webhook-info')
        webhookInfo.value = data
        showMessage('Webhook info loaded', 'success')
    } catch (error) {
        showMessage('Error checking webhook info: ' + error.message, 'error')
    } finally {
        loading.value = false
    }
}

async function setWebhook() {
    if (!webhookUrl.value) {
        showMessage('Please enter webhook URL', 'error')
        return
    }

    loading.value = true
    try {
        const response = await $fetch('/api/telegram/set-webhook', {
            method: 'POST',
            body: { webhook_url: webhookUrl.value }
        })
        setResult.value = response

        if (response.success) {
            showMessage('Webhook set successfully', 'success')
        } else {
            showMessage('Failed to set webhook: ' + response.error, 'error')
        }
    } catch (error) {
        showMessage('Error setting webhook: ' + error.message, 'error')
    } finally {
        loading.value = false
    }
}

async function sendTestNotification() {
    loading.value = true
    try {
        const response = await $fetch('/api/telegram/test-notifications', {
            method: 'POST',
            body: {
                type: testType.value,
                bookingId: 'test-' + Date.now()
            }
        })
        testResult.value = response
        showMessage('Test notification sent', 'success')
    } catch (error) {
        showMessage('Error sending test notification: ' + error.message, 'error')
    } finally {
        loading.value = false
    }
}

function showMessage(text, type) {
    message.value = text
    messageClass.value = type === 'success'
        ? 'bg-green-100 text-green-800'
        : 'bg-red-100 text-red-800'

    setTimeout(() => {
        message.value = ''
    }, 5000)
}

// Auto-detect current URL for webhook
onMounted(() => {
    if (process.client) {
        const baseUrl = window.location.origin
        webhookUrl.value = `${baseUrl}/api/telegram/webhook`
    }
})
</script>
