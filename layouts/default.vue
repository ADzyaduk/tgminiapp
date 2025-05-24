<template>
  <div class="min-h-screen flex flex-col">
    <MainHeader />
    
    <main class="flex-1">
      <slot />
    </main>
    
    <footer class="py-4 text-center text-sm">
      <div class="container mx-auto px-4">
        © {{ new Date().getFullYear() }} BoatRent. Аренда лодок.
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Импортируем компоненты
import MainHeader from '~/components/MainHeader.vue'
</script> 