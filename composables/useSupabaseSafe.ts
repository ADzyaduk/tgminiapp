export const useSupabaseSafe = () => {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  
  // Проверяем, нужно ли отключать realtime
  const shouldDisableRealtime = config.public.disableRealtime === 'true' || process.env.NODE_ENV === 'production'
  
  // Безопасный метод для создания каналов
  const createChannel = (name: string, opts?: any) => {
    if (shouldDisableRealtime) {
      console.warn('Realtime отключен на продакшене')
      // Возвращаем заглушку канала
      return {
        on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        subscribe: () => ({ unsubscribe: () => {} }),
        unsubscribe: () => {},
        send: () => {},
        track: () => {},
        untrack: () => {},
        presence: { state: {}, track: () => {}, untrack: () => {} }
      }
    }
    
    return supabase.channel(name, opts)
  }
  
  return {
    ...supabase,
    channel: createChannel,
    isRealtimeDisabled: shouldDisableRealtime
  }
} 