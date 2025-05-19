<template>
  <div class="boat-gallery">
    <div v-if="images.length" class="grid grid-cols-3 gap-4">
      <img
        v-for="(src, i) in images"
        :key="i"
        :src="src"
        :alt="`Boat image ${i+1}`"
        loading="lazy"
        class="object-cover w-full h-auto rounded"
      />
    </div>
    <div v-else class="text-center">
      <img
        src="/boat-placeholder.jpg"
        alt="No images available"
        class="object-cover w-full h-auto rounded opacity-50"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBoatGallery } from '~/composables/useBoatGallery'
const { images } = useBoatGallery()
</script>
