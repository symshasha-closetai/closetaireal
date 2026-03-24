export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      daily_looks: {
        Row: {
          created_at: string
          id: string
          image_url: string
          look_date: string
          streak: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          look_date?: string
          streak?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          look_date?: string
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_ratings: {
        Row: {
          ai_feedback: string | null
          created_at: string
          id: string
          image_url: string | null
          rating_date: string
          score: number
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          rating_date?: string
          score: number
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          rating_date?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      drip_history: {
        Row: {
          confidence_score: number | null
          created_at: string
          full_result: Json | null
          id: string
          image_hash: string | null
          image_url: string | null
          kept: boolean
          killer_tag: string | null
          praise_line: string | null
          score: number
          user_id: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          full_result?: Json | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          kept?: boolean
          killer_tag?: string | null
          praise_line?: string | null
          score: number
          user_id: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          full_result?: Json | null
          id?: string
          image_hash?: string | null
          image_url?: string | null
          kept?: boolean
          killer_tag?: string | null
          praise_line?: string | null
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          content_type: string
          conversation_id: string
          created_at: string
          expires_at: string | null
          id: string
          kept: boolean
          metadata: Json | null
          sender_id: string
        }
        Insert: {
          content?: string
          content_type?: string
          conversation_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kept?: boolean
          metadata?: Json | null
          sender_id: string
        }
        Update: {
          content?: string
          content_type?: string
          conversation_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          kept?: boolean
          metadata?: Json | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      outfit_calendar: {
        Row: {
          created_at: string
          id: string
          outfit_data: Json
          outfit_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          outfit_data?: Json
          outfit_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          outfit_data?: Json
          outfit_date?: string
          user_id?: string
        }
        Relationships: []
      }
      outfits: {
        Row: {
          ai_explanation: string | null
          bottom_id: string | null
          created_at: string
          id: string
          occasion: string | null
          score: number | null
          shoes_id: string | null
          top_id: string | null
          user_id: string
        }
        Insert: {
          ai_explanation?: string | null
          bottom_id?: string | null
          created_at?: string
          id?: string
          occasion?: string | null
          score?: number | null
          shoes_id?: string | null
          top_id?: string | null
          user_id: string
        }
        Update: {
          ai_explanation?: string | null
          bottom_id?: string | null
          created_at?: string
          id?: string
          occasion?: string | null
          score?: number | null
          shoes_id?: string | null
          top_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outfits_bottom_id_fkey"
            columns: ["bottom_id"]
            isOneToOne: false
            referencedRelation: "wardrobe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_shoes_id_fkey"
            columns: ["shoes_id"]
            isOneToOne: false
            referencedRelation: "wardrobe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outfits_top_id_fkey"
            columns: ["top_id"]
            isOneToOne: false
            referencedRelation: "wardrobe"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      saved_outfits: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          items: Json
          kept: boolean
          name: string
          occasion: string | null
          reasoning: Json | null
          score: number | null
          score_breakdown: Json | null
          tryon_image: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          items?: Json
          kept?: boolean
          name: string
          occasion?: string | null
          reasoning?: Json | null
          score?: number | null
          score_breakdown?: Json | null
          tryon_image?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          items?: Json
          kept?: boolean
          name?: string
          occasion?: string | null
          reasoning?: Json | null
          score?: number | null
          score_breakdown?: Json | null
          tryon_image?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_suggestions: {
        Row: {
          category: string | null
          created_at: string
          drip_score: number | null
          id: string
          image: string | null
          item_name: string
          kept: boolean
          killer_tag: string | null
          reason: string | null
          suggestion_type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          drip_score?: number | null
          id?: string
          image?: string | null
          item_name: string
          kept?: boolean
          killer_tag?: string | null
          reason?: string | null
          suggestion_type?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          drip_score?: number | null
          id?: string
          image?: string | null
          item_name?: string
          kept?: boolean
          killer_tag?: string | null
          reason?: string | null
          suggestion_type?: string
          user_id?: string
        }
        Relationships: []
      }
      style_profiles: {
        Row: {
          ai_body_analysis: Json | null
          ai_face_analysis: Json | null
          body_photo_url: string | null
          body_proportions: Json | null
          body_type: string | null
          created_at: string
          face_photo_url: string | null
          face_shape: string | null
          gender: string | null
          id: string
          model_image_url: string | null
          skin_tone: string | null
          style_personality: string | null
          style_personality_reason: string | null
          style_personality_updated_at: string | null
          style_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_body_analysis?: Json | null
          ai_face_analysis?: Json | null
          body_photo_url?: string | null
          body_proportions?: Json | null
          body_type?: string | null
          created_at?: string
          face_photo_url?: string | null
          face_shape?: string | null
          gender?: string | null
          id?: string
          model_image_url?: string | null
          skin_tone?: string | null
          style_personality?: string | null
          style_personality_reason?: string | null
          style_personality_updated_at?: string | null
          style_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_body_analysis?: Json | null
          ai_face_analysis?: Json | null
          body_photo_url?: string | null
          body_proportions?: Json | null
          body_type?: string | null
          created_at?: string
          face_photo_url?: string | null
          face_shape?: string | null
          gender?: string | null
          id?: string
          model_image_url?: string | null
          skin_tone?: string | null
          style_personality?: string | null
          style_personality_reason?: string | null
          style_personality_updated_at?: string | null
          style_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_suggestions: {
        Row: {
          created_at: string | null
          id: string
          suggestion: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          suggestion: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          suggestion?: string
          user_id?: string
        }
        Relationships: []
      }
      wardrobe: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          custom_category: string | null
          deleted_at: string | null
          id: string
          image_url: string
          material: string | null
          name: string | null
          original_image_url: string | null
          pin_order: number | null
          pinned: boolean | null
          quality: string | null
          season: string | null
          style: string | null
          type: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          custom_category?: string | null
          deleted_at?: string | null
          id?: string
          image_url: string
          material?: string | null
          name?: string | null
          original_image_url?: string | null
          pin_order?: number | null
          pinned?: boolean | null
          quality?: string | null
          season?: string | null
          style?: string | null
          type: string
          user_id: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          custom_category?: string | null
          deleted_at?: string | null
          id?: string
          image_url?: string
          material?: string | null
          name?: string | null
          original_image_url?: string | null
          pin_order?: number | null
          pinned?: boolean | null
          quality?: string | null
          season?: string | null
          style?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wardrobe_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
