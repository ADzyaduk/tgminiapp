<template>
    <div class="container mx-auto p-4 text-center">
        <h1 class="text-2xl font-bold mb-4">Профиль пользователя</h1>
        <p class="mb-4">Теперь для управления профилем используется Telegram авторизация</p>
        <UButton to="/telegram-auth" color="primary">
            Перейти к настройкам
        </UButton>
    </div>
</template>

<script setup lang="ts">
definePageMeta({
    title: 'Профиль'
})
</script>
