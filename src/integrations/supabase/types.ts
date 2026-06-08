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
      ai_chat_messages: {
        Row: {
          ai_profile_id: string
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          ai_profile_id: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          ai_profile_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_ai_profile_id_fkey"
            columns: ["ai_profile_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_message_reactions: {
        Row: {
          ai_message_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          ai_message_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          ai_message_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_message_reactions_ai_message_id_fkey"
            columns: ["ai_message_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          system_prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          system_prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          system_prompt?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      blocked_devices: {
        Row: {
          blocked_user_id: string
          blocker_user_id: string
          created_at: string
          device_id: string
          id: string
        }
        Insert: {
          blocked_user_id: string
          blocker_user_id: string
          created_at?: string
          device_id: string
          id?: string
        }
        Update: {
          blocked_user_id?: string
          blocker_user_id?: string
          created_at?: string
          device_id?: string
          id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_device_id: string | null
          blocked_user_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_device_id?: string | null
          blocked_user_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_device_id?: string | null
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          request_id: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          request_id?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          request_id?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "chat_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          id: string
          nickname: string | null
          user_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          id?: string
          nickname?: string | null
          user_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          id?: string
          nickname?: string | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          joined_at?: string
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
          created_by: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          device_id: string | null
          encryption_nonce: string | null
          encryption_version: number | null
          file_name: string | null
          hidden_message: string | null
          id: string
          is_encrypted: boolean
          is_opened: boolean
          media_type: string | null
          media_url: string | null
          message_type: string
          opened_at: string | null
          read_at: string | null
          replied_message_content: string | null
          replied_message_id: string | null
          replied_message_type: string | null
          replied_user_id: string | null
          sender_id: string
          text_style: string
          theme_type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          device_id?: string | null
          encryption_nonce?: string | null
          encryption_version?: number | null
          file_name?: string | null
          hidden_message?: string | null
          id?: string
          is_encrypted?: boolean
          is_opened?: boolean
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          opened_at?: string | null
          read_at?: string | null
          replied_message_content?: string | null
          replied_message_id?: string | null
          replied_message_type?: string | null
          replied_user_id?: string | null
          sender_id: string
          text_style?: string
          theme_type?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          device_id?: string | null
          encryption_nonce?: string | null
          encryption_version?: number | null
          file_name?: string | null
          hidden_message?: string | null
          id?: string
          is_encrypted?: boolean
          is_opened?: boolean
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          opened_at?: string | null
          read_at?: string | null
          replied_message_content?: string | null
          replied_message_id?: string | null
          replied_message_type?: string | null
          replied_user_id?: string | null
          sender_id?: string
          text_style?: string
          theme_type?: string
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
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          device_id: string | null
          display_name: string
          id: string
          status: string | null
          updated_at: string
          user_code: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          device_id?: string | null
          display_name: string
          id?: string
          status?: string | null
          updated_at?: string
          user_code: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          device_id?: string | null
          display_name?: string
          id?: string
          status?: string | null
          updated_at?: string
          user_code?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string
          device_id: string
          first_seen_at: string
          id: string
          language: string | null
          last_seen_at: string
          platform: string | null
          screen_resolution: string | null
          timezone: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          first_seen_at?: string
          id?: string
          language?: string | null
          last_seen_at?: string
          platform?: string | null
          screen_resolution?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          first_seen_at?: string
          id?: string
          language?: string | null
          last_seen_at?: string
          platform?: string | null
          screen_resolution?: string | null
          timezone?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_encryption_identities: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      starred_messages: {
        Row: {
          ai_message_id: string | null
          created_at: string
          id: string
          message_id: string | null
          user_id: string
        }
        Insert: {
          ai_message_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          user_id: string
        }
        Update: {
          ai_message_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starred_messages_ai_message_id_fkey"
            columns: ["ai_message_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_chat_request: {
        Args: { _request_id: string }
        Returns: Json
      }
      block_chat_user: {
        Args: { _blocked_user_id: string }
        Returns: string
      }
      generate_user_code: { Args: never; Returns: string }
      get_latest_device_id: {
        Args: { _user_id: string }
        Returns: string
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      reject_chat_request: {
        Args: { _request_id: string; _should_block?: boolean }
        Returns: string | null
      }
      send_chat_request: {
        Args: { _receiver_id: string }
        Returns: string
      }
      unblock_and_accept_chat_request: {
        Args: { _request_id: string }
        Returns: Json
      }
      unblock_chat_user: {
        Args: { _blocked_user_id: string }
        Returns: undefined
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
