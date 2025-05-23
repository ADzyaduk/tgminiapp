// composables/useBoatImages.ts
import { computed } from 'vue'
import type { BoatRow } from '~/types/boats'

/**
 * Глобальный импорт всех изображений лодок через Vite.
 * as: 'url' — сразу получаем URL, eager: true — синхронно.
 */
const allBoatImages = import.meta.glob('@/assets/boats/*/*.{png,jpg,jpeg}', {
  eager: true,
  as: 'url',
})

export function useBoatImages(boat: BoatRow | { slug: string, name?: string } | any) {
  // Убедимся, что у нас есть slug независимо от структуры объекта
  const slug = computed(() => {
    if (!boat) return null;
    // Если передали boat.slug, используем его
    if (typeof boat === 'object' && 'slug' in boat && boat.slug) {
      return boat.slug;
    }
    return null;
  });

  const images = computed<string[]>(() => {
    if (!slug.value) return [];
    
    const filteredPaths = Object.keys(allBoatImages)
      .filter(path => path.toLowerCase().includes(`/${slug.value.toLowerCase()}/`));
    
    return filteredPaths.map(path => (allBoatImages as Record<string,string>)[path]);
  });

  const primary = computed(() => {
    const img = images.value[0] || '';
    return img;
  });

  return {
    images,
    primary,
    slug
  };
}
