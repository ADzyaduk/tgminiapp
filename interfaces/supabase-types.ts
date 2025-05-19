// Временные типы для Supabase, пока не настроено генерирование

// Базовые типы для Supabase
export interface Profile {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  role?: string;
}

export interface Review {
  id?: string;
  boat_id: string;
  user_id: string;
  rating: number;
  text: string;
  response?: string;
  created_at?: string;
  profiles?: Profile;
}

export interface RatingCount {
  rating: number;
  count: number;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
  metadata?: any;
}

export interface Invite {
  id: string;
  code: string;
  role: string;
  used: boolean;
  used_by?: string;
  used_at?: string;
  created_at: string;
  created_by?: string;
  expires_at?: string;
  usage_limit?: number;
  used_count?: number;
  note?: string;
}

// Расширение типов Supabase
declare module '@supabase/supabase-js' {
  interface PostgrestBuilder {
    rpc<T>(functionName: string, params?: any): Promise<{ data: T | null; error: any }>;
  }
  
  interface PostgrestFilterBuilder<T> {
    select<U = T>(columns?: string): PostgrestFilterBuilder<U>;
    single<U = T>(): Promise<{ data: U | null; error: any }>;
    limit(count: number): PostgrestFilterBuilder<T>;
    eq(column: string, value: any): PostgrestFilterBuilder<T>;
    order(column: string, options?: { ascending?: boolean }): PostgrestFilterBuilder<T>;
    range(from: number, to: number): PostgrestFilterBuilder<T>;
  }
} 