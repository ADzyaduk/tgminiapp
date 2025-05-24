// composables/useImageAnalyzer.ts
export function useImageAnalyzer() {
  
  // Анализирует соотношение сторон изображения
  function analyzeAspectRatio(width: number, height: number) {
    const ratio = width / height
    
    let orientation: 'portrait' | 'landscape' | 'square'
    let description: string
    
    if (ratio < 0.9) {
      orientation = 'portrait'
      description = 'Портретная'
    } else if (ratio > 1.1) {
      orientation = 'landscape' 
      description = 'Альбомная'
    } else {
      orientation = 'square'
      description = 'Квадратная'
    }
    
    return {
      ratio,
      orientation,
      description,
      width,
      height
    }
  }
  
  // Рекомендует режим отображения на основе соотношения сторон
  function recommendDisplayMode(aspectRatio: number) {
    if (aspectRatio < 0.6) {
      return {
        mode: 'contain' as const,
        reason: 'Очень вертикальное изображение - лучше показать полностью'
      }
    } else if (aspectRatio > 2.5) {
      return {
        mode: 'contain' as const,
        reason: 'Очень широкое изображение - лучше показать полностью'
      }
    } else {
      return {
        mode: 'cover' as const,
        reason: 'Стандартное соотношение - можно обрезать'
      }
    }
  }
  
  // Получает оптимальное позиционирование для object-cover
  function getOptimalPosition(aspectRatio: number, orientation: 'portrait' | 'landscape' | 'square') {
    if (orientation === 'portrait') {
      return 'object-center' // Для портретных изображений показываем центр
    } else if (orientation === 'landscape') {
      return 'object-center' // Для альбомных - центр
    } else {
      return 'object-center' // Для квадратных - центр
    }
  }
  
  // Форматирует информацию об изображении для отладки
  function formatDebugInfo(width: number, height: number) {
    const analysis = analyzeAspectRatio(width, height)
    const recommendation = recommendDisplayMode(analysis.ratio)
    const position = getOptimalPosition(analysis.ratio, analysis.orientation)
    
    return {
      ...analysis,
      recommendation,
      position,
      debugString: `${width}×${height} (${analysis.ratio.toFixed(2)}) - ${analysis.description}`
    }
  }
  
  return {
    analyzeAspectRatio,
    recommendDisplayMode,
    getOptimalPosition,
    formatDebugInfo
  }
} 