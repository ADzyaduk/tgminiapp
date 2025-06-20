export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      boat_managers: {
        Row: {
          boat_id: string
          id: number
          user_id: string
        }
        Insert: {
          boat_id: string
          id?: number
          user_id: string
        }
        Update: {
          boat_id?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boat_managers_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boat_managers_user_id_fkey1"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boats: {
        Row: {
          agent_price: number
          created_at: string | null
          id: string
          name: string
          price: number
          slug: string | null
          status: string | null
        }
        Insert: {
          agent_price: number
          created_at?: string | null
          id?: string
          name: string
          price: number
          slug?: string | null
          status?: string | null
        }
        Update: {
          agent_price?: number
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          slug?: string | null
          status?: string | null
        }
        Relationships: []
      }
      bookings: {
        Row: {
          boat_id: string
          created_at: string
          end_time: string
          guest_name: string | null
          guest_note: string | null
          guest_phone: string | null
          id: number
          peoples: string | null
          pph: string | null
          prepayment: number | null
          price: number
          start_time: string
          status: string
          user_id: string | null
        }
        Insert: {
          boat_id: string
          created_at?: string
          end_time: string
          guest_name?: string | null
          guest_note?: string | null
          guest_phone?: string | null
          id?: number
          peoples?: string | null
          pph?: string | null
          prepayment?: number | null
          price: number
          start_time: string
          status?: string
          user_id?: string | null
        }
        Update: {
          boat_id?: string
          created_at?: string
          end_time?: string
          guest_name?: string | null
          guest_note?: string | null
          guest_phone?: string | null
          id?: number
          peoples?: string | null
          pph?: string | null
          prepayment?: number | null
          price?: number
          start_time?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_boat"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_trip_bookings: {
        Row: {
          adult_count: number | null
          child_count: number | null
          created_at: string | null
          group_trip_id: string | null
          guest_name: string
          guest_phone: string | null
          id: string
          metadata: Json | null
          notes: string | null
          status: string | null
          total_price: number
          user_id: string | null
        }
        Insert: {
          adult_count?: number | null
          child_count?: number | null
          created_at?: string | null
          group_trip_id?: string | null
          guest_name: string
          guest_phone?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          total_price: number
          user_id?: string | null
        }
        Update: {
          adult_count?: number | null
          child_count?: number | null
          created_at?: string | null
          group_trip_id?: string | null
          guest_name?: string
          guest_phone?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          status?: string | null
          total_price?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_trip_bookings_group_trip_id_fkey"
            columns: ["group_trip_id"]
            isOneToOne: false
            referencedRelation: "group_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_trip_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_trips: {
        Row: {
          adult_price: number
          available_seats: number
          boat_id: string | null
          child_price: number
          created_at: string | null
          created_by: string | null
          description: string | null
          end_time: string
          id: string
          metadata: Json | null
          name: string
          start_time: string
          status: string | null
          total_seats: number
        }
        Insert: {
          adult_price: number
          available_seats: number
          boat_id?: string | null
          child_price: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time: string
          id?: string
          metadata?: Json | null
          name: string
          start_time: string
          status?: string | null
          total_seats: number
        }
        Update: {
          adult_price?: number
          available_seats?: number
          boat_id?: string | null
          child_price?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_time?: string
          id?: string
          metadata?: Json | null
          name?: string
          start_time?: string
          status?: string | null
          total_seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_trips_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          role: string | null
          telegram_id: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          telegram_id?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          telegram_id?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          boat_id: string | null
          created_at: string | null
          id: string
          rating: number
          response: string | null
          text: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          boat_id?: string | null
          created_at?: string | null
          id?: string
          rating: number
          response?: string | null
          text?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          boat_id?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          response?: string | null
          text?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_boat_id_fkey"
            columns: ["boat_id"]
            isOneToOne: false
            referencedRelation: "boats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_rating_counts_for_boat: {
        Args: { boat_id_param: string }
        Returns: {
          rating: number
          count: number
        }[]
      }
      get_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      update_user_role: {
        Args: { p_user_id: string; p_role: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
