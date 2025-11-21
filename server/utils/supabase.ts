import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/interfaces/supabase-schema'

export async function serverSupabaseClient(event: any): Promise<SupabaseClient<Database>> {
  const config = useRuntimeConfig(event)
  
  // Получаем переменные из runtimeConfig или process.env
  const supabaseUrl = config.public.supabaseUrl || process.env.SUPABASE_URL
  const supabaseKey = config.public.supabaseAnonKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!\n\n` +
      `Check your Supabase project's API settings to find these values\n` +
      `https://supabase.com/dashboard/project/_/settings/api`
    )
  }

  // Создаем клиент для сервера
  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    }
  })
}

