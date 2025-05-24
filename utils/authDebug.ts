// Утилита для диагностики проблем авторизации
export const debugAuth = () => {
  if (typeof window === 'undefined') return

  console.group('🔍 Auth Debug Info')
  
  // Проверяем localStorage
  console.log('📦 LocalStorage tokens:')
  const tokens = ['sb-access-token', 'sb-refresh-token', 'sb-auth-token', 'sb-auth-session']
  tokens.forEach(key => {
    const value = localStorage.getItem(key)
    console.log(`  ${key}: ${value ? '✅ EXISTS' : '❌ MISSING'}`)
    if (value && key === 'sb-auth-session') {
      try {
        const parsed = JSON.parse(value)
        console.log(`    expires_at: ${new Date(parsed.expires_at * 1000).toLocaleString()}`)
      } catch (e) {
        console.log(`    ⚠️ Invalid JSON`)
      }
    }
  })

  // Проверяем cookies
  console.log('🍪 Document cookies:')
  if (document.cookie) {
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=')
      if (name.includes('sb-') || name.includes('supabase')) {
        console.log(`  ${name}: ✅ EXISTS`)
      }
    })
  } else {
    console.log('  ❌ No cookies found')
  }

  // Проверяем настройки браузера
  console.log('🌐 Browser info:')
  console.log(`  User Agent: ${navigator.userAgent}`)
  console.log(`  Cookie enabled: ${navigator.cookieEnabled}`)
  console.log(`  Protocol: ${window.location.protocol}`)
  console.log(`  Host: ${window.location.host}`)

  console.groupEnd()
}

// Автоматическая диагностика в dev режиме
if (import.meta.dev && typeof window !== 'undefined') {
  // Добавляем в глобальный объект для вызова из консоли
  ;(window as any).debugAuth = debugAuth
} 