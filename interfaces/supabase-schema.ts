export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      boats: {
        Row: {
          id: string
          name: string
          description: string
          price_per_hour: number
          capacity: number
          features: string[]
          images: string[]
          location: string
          created_at: string
          owner_id: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          price_per_hour: number
          capacity: number
          features?: string[]
          images?: string[]
          location: string
          created_at?: string
          owner_id: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          price_per_hour?: number
          capacity?: number
          features?: string[]
          images?: string[]
          location?: string
          created_at?: string
          owner_id?: string
        }
      }
      reviews: {
        Row: {
          id: string
          boat_id: string
          user_id: string
          rating: number
          text: string
          response: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          boat_id: string
          user_id: string
          rating: number
          text: string
          response?: string | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          boat_id?: string
          user_id?: string
          rating?: number
          text?: string
          response?: string | null
          created_at?: string
          updated_at?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar: string | null
          role: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar?: string | null
          role?: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar?: string | null
          role?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          message: string
          type: string
          read: boolean
          created_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          type: string
          read?: boolean
          created_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          type?: string
          read?: boolean
          created_at?: string
          metadata?: Json | null
        }
      }
      invites: {
        Row: {
          id: string
          code: string
          role: string
          used: boolean
          used_by: string | null
          used_at: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          usage_limit: number | null
          used_count: number
          note: string | null
        }
        Insert: {
          id?: string
          code: string
          role: string
          used?: boolean
          used_by?: string | null
          used_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          usage_limit?: number | null
          used_count?: number
          note?: string | null
        }
        Update: {
          id?: string
          code?: string
          role?: string
          used?: boolean
          used_by?: string | null
          used_at?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          usage_limit?: number | null
          used_count?: number
          note?: string | null
        }
      }
    }
    Functions: {
      get_rating_counts_for_boat: {
        Args: {
          boat_id_param: string
        }
        Returns: {
          rating: number
          count: number
        }[]
      }
    }
  }
} 