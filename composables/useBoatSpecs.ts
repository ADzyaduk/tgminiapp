// composables/useBoatSpecs.ts
import { computed } from 'vue'
import type { BoatRow } from '~/types/boats'

/** Метки для полей specs */
const LABELS = {
  capacity: 'Вместимость',
  length:   'Длина',
  engine:   'Двигатель',
  year:     'Год выпуска',
  width:    'Ширина',
  draft:    'Осадка',
} as const

type SpecLabelKey = keyof typeof LABELS

export function useBoatSpecs(boat: BoatRow) {
  const specs = computed(() => {
    if (!boat.specs || typeof boat.specs !== 'object') return []
    return Object.entries(boat.specs)
      .filter(([k]) => k in LABELS)
      .map(([k, v]) => ({
        label: LABELS[k as SpecLabelKey],
        value: v?.toString() || '—'
      }))
  })

  const hasSpecs = computed(() => specs.value.length > 0)

  return {
    specs,
    hasSpecs,
  }
}
