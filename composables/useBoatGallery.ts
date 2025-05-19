// composables/useBoatGallery.ts
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useBoatGallery() {
  const route = useRoute()
  const slug  = computed(() => route.params.slug as string)

  const allBoatImages = import.meta.glob('@/assets/boats/*/*.{png,jpg,jpeg}', {
    eager: true,
    as: 'url'
  })

  const images = computed<string[]>(() =>
    Object.keys(allBoatImages)
      .filter(path => path.includes(`/${slug.value}/`))
      .map(path => (allBoatImages as Record<string,string>)[path])
  )

  return { images }
}
