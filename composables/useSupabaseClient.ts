import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/interfaces/supabase-schema'

let supabaseClient: SupabaseClient<Database> | null = null

export const useSupabaseClient = (): SupabaseClient<Database> => {
  // Если клиент уже создан, возвращаем его
  if (supabaseClient) {
    return supabaseClient
  }

  const config = useRuntimeConfig()
  
  // Получаем переменные из runtimeConfig или process.env
  const supabaseUrl = config.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseKey = config.public.supabaseAnonKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    const missing = []
    if (!supabaseUrl) missing.push('SUPABASE_URL')
    if (!supabaseKey) missing.push('SUPABASE_KEY или SUPABASE_ANON_KEY')
    
    throw new Error(
      `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n` +
      `Missing: ${missing.join(', ')}\n\n` +
      `Check your Supabase project's API settings to find these values\n` +
      `https://supabase.com/dashboard/project/_/settings/api`
    )
  }

  // Создаем клиент
  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    }
  })

  return supabaseClient
}

