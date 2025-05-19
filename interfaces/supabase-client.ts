import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase-schema'

export type TypedSupabaseClient = SupabaseClient<Database>

// Типы для таблиц
export type ReviewRow = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update']

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'] 
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type NotificationRow = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
export type NotificationUpdate = Database['public']['Tables']['notifications']['Update']

export type InviteRow = Database['public']['Tables']['invites']['Row']
export type InviteInsert = Database['public']['Tables']['invites']['Insert']
export type InviteUpdate = Database['public']['Tables']['invites']['Update']

export type BoatRow = Database['public']['Tables']['boats']['Row']
export type BoatInsert = Database['public']['Tables']['boats']['Insert']
export type BoatUpdate = Database['public']['Tables']['boats']['Update']

// Типы для RPC функций
export type RatingCountResult = Database['public']['Functions']['get_rating_counts_for_boat']['Returns'][0]

// Переэкспорт типов для совместимости
export { type Json } from './supabase-schema' 