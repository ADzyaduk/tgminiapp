// composables/useBoatFormatting.ts
import { computed } from 'vue'

/** Composable для форматирования цен и значений */
export function useBoatFormatting(price: number, agentPrice: number) {
  const formattedPrice = (val: number) =>
    new Intl.NumberFormat('ru-RU').format(val)

  const showAgentPrice = computed(() =>
    agentPrice > 0 && agentPrice < price
  )

  const discountPerc = computed(() => {
    if (!showAgentPrice.value) return 0
    return Math.round((1 - agentPrice / price) * 100)
  })

  return {
    formattedPrice,
    showAgentPrice,
    discountPerc,
  }
}
