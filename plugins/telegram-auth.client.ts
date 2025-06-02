export default defineNuxtPlugin(async () => {
  const { initAuth } = useTelegramAuth()

  try {
    await initAuth()
    console.log('🚀 Telegram auth initialized')
  } catch (error) {
    console.error('❌ Failed to initialize Telegram auth:', error)
  }
})
