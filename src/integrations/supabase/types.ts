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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_log: {
        Row: {
          action_type: string
          details: Json | null
          device_id: string | null
          executed_at: string | null
          id: string
          ig_account_id: string | null
          status: string
          target_url: string | null
          target_username: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          details?: Json | null
          device_id?: string | null
          executed_at?: string | null
          id?: string
          ig_account_id?: string | null
          status: string
          target_url?: string | null
          target_username?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          details?: Json | null
          device_id?: string | null
          executed_at?: string | null
          id?: string
          ig_account_id?: string | null
          status?: string
          target_url?: string | null
          target_username?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_log_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_commands: {
        Row: {
          command: string
          created_at: string | null
          device_id: string | null
          executed_at: string | null
          id: string
          ig_account_id: string
          params: Json | null
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          command: string
          created_at?: string | null
          device_id?: string | null
          executed_at?: string | null
          id?: string
          ig_account_id: string
          params?: Json | null
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          command?: string
          created_at?: string | null
          device_id?: string | null
          executed_at?: string | null
          id?: string
          ig_account_id?: string
          params?: Json | null
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_commands_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bridge_tokens: {
        Row: {
          created_at: string | null
          id: string
          ig_account_id: string | null
          is_active: boolean | null
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ig_account_id?: string | null
          is_active?: boolean | null
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ig_account_id?: string | null
          is_active?: boolean | null
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bridge_tokens_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_action_cache: {
        Row: {
          action_type: string
          day: string
          failed_count: number | null
          ig_account_id: string
          success_count: number | null
          total_count: number | null
          user_id: string
        }
        Insert: {
          action_type: string
          day: string
          failed_count?: number | null
          ig_account_id: string
          success_count?: number | null
          total_count?: number | null
          user_id: string
        }
        Update: {
          action_type?: string
          day?: string
          failed_count?: number | null
          ig_account_id?: string
          success_count?: number | null
          total_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_action_cache_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_stats: {
        Row: {
          device_id: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          ig_account_id: string | null
          posts_count: number | null
          recorded_at: string | null
          user_id: string | null
        }
        Insert: {
          device_id?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          ig_account_id?: string | null
          posts_count?: number | null
          recorded_at?: string | null
          user_id?: string | null
        }
        Update: {
          device_id?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          ig_account_id?: string | null
          posts_count?: number | null
          recorded_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_stats_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_accounts: {
        Row: {
          bot_mode: string | null
          bot_online: boolean | null
          bot_schedule: Json | null
          bot_status: string | null
          bridge_link_token: string | null
          bridge_version: string | null
          created_at: string | null
          delay_max: number | null
          delay_min: number | null
          device_id: string | null
          followers_count: number | null
          following_count: number | null
          id: string
          ig_user_id: string | null
          ig_username: string
          is_active: boolean | null
          last_heartbeat: string | null
          likes_per_follow: number | null
          max_actions_per_session: number | null
          posts_count: number | null
          profile_pic_url: string | null
          queue_processed: number | null
          queue_total: number | null
          safety_preset: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bot_mode?: string | null
          bot_online?: boolean | null
          bot_schedule?: Json | null
          bot_status?: string | null
          bridge_link_token?: string | null
          bridge_version?: string | null
          created_at?: string | null
          delay_max?: number | null
          delay_min?: number | null
          device_id?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          ig_user_id?: string | null
          ig_username: string
          is_active?: boolean | null
          last_heartbeat?: string | null
          likes_per_follow?: number | null
          max_actions_per_session?: number | null
          posts_count?: number | null
          profile_pic_url?: string | null
          queue_processed?: number | null
          queue_total?: number | null
          safety_preset?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bot_mode?: string | null
          bot_online?: boolean | null
          bot_schedule?: Json | null
          bot_status?: string | null
          bridge_link_token?: string | null
          bridge_version?: string | null
          created_at?: string | null
          delay_max?: number | null
          delay_min?: number | null
          device_id?: string | null
          followers_count?: number | null
          following_count?: number | null
          id?: string
          ig_user_id?: string | null
          ig_username?: string
          is_active?: boolean | null
          last_heartbeat?: string | null
          likes_per_follow?: number | null
          max_actions_per_session?: number | null
          posts_count?: number | null
          profile_pic_url?: string | null
          queue_processed?: number | null
          queue_total?: number | null
          safety_preset?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_stats: {
        Row: {
          blocks_count: number | null
          comments_count: number | null
          device_id: string | null
          errors_count: number | null
          follows_count: number | null
          id: string
          ig_account_id: string | null
          likes_count: number | null
          session_end: string | null
          session_start: string | null
          skips_count: number | null
          unfollows_count: number | null
          user_id: string | null
        }
        Insert: {
          blocks_count?: number | null
          comments_count?: number | null
          device_id?: string | null
          errors_count?: number | null
          follows_count?: number | null
          id?: string
          ig_account_id?: string | null
          likes_count?: number | null
          session_end?: string | null
          session_start?: string | null
          skips_count?: number | null
          unfollows_count?: number | null
          user_id?: string | null
        }
        Update: {
          blocks_count?: number | null
          comments_count?: number | null
          device_id?: string | null
          errors_count?: number | null
          follows_count?: number | null
          id?: string
          ig_account_id?: string | null
          likes_count?: number | null
          session_end?: string | null
          session_start?: string | null
          skips_count?: number | null
          unfollows_count?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_stats_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      target_queue: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          details: Json | null
          device_id: string | null
          id: string
          ig_account_id: string
          priority: number | null
          processed_at: string | null
          source: string | null
          status: string | null
          username: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          details?: Json | null
          device_id?: string | null
          id?: string
          ig_account_id: string
          priority?: number | null
          processed_at?: string | null
          source?: string | null
          status?: string | null
          username: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          details?: Json | null
          device_id?: string | null
          id?: string
          ig_account_id?: string
          priority?: number | null
          processed_at?: string | null
          source?: string | null
          status?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "targeting_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "target_queue_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      targeting_campaigns: {
        Row: {
          competitors: Json | null
          created_at: string
          hashtags: Json | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          niche: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          competitors?: Json | null
          created_at?: string
          hashtags?: Json | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          niche?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          competitors?: Json | null
          created_at?: string
          hashtags?: Json | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          niche?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          automation_paused: boolean | null
          automation_paused_at: string | null
          id: string
          settings_json: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          automation_paused?: boolean | null
          automation_paused_at?: string | null
          id?: string
          settings_json?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          automation_paused?: boolean | null
          automation_paused_at?: string | null
          id?: string
          settings_json?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whitelist: {
        Row: {
          added_at: string | null
          full_name: string | null
          id: string
          ig_account_id: string | null
          ig_user_id: string
          profile_pic_url: string | null
          reason: string | null
          user_id: string
          username: string
        }
        Insert: {
          added_at?: string | null
          full_name?: string | null
          id?: string
          ig_account_id?: string | null
          ig_user_id: string
          profile_pic_url?: string | null
          reason?: string | null
          user_id: string
          username: string
        }
        Update: {
          added_at?: string | null
          full_name?: string | null
          id?: string
          ig_account_id?: string | null
          ig_user_id?: string
          profile_pic_url?: string | null
          reason?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      daily_action_summary: {
        Row: {
          action_type: string | null
          day: string | null
          failed_count: number | null
          ig_account_id: string | null
          success_count: number | null
          total_count: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_log_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_last_30_days: {
        Row: {
          day: string | null
          followers_count: number | null
          following_count: number | null
          ig_account_id: string | null
          posts_count: number | null
          recorded_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "growth_stats_ig_account_id_fkey"
            columns: ["ig_account_id"]
            isOneToOne: false
            referencedRelation: "ig_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_targets_batch: {
        Args: {
          p_campaign_id?: string
          p_ig_account_id: string
          p_source?: string
          p_usernames: string[]
        }
        Returns: number
      }
      auto_provision_ig_account: {
        Args: { p_device_id: string; p_ig_username: string }
        Returns: string
      }
      cleanup_growth_stats: { Args: never; Returns: number }
      clear_target_queue: {
        Args: { p_ig_account_id: string; p_status?: string }
        Returns: number
      }
      fetch_next_targets: {
        Args: { p_ig_account_id: string; p_limit?: number }
        Returns: {
          campaign_id: string
          campaign_name: string
          campaign_niche: string
          id: string
          priority: number
          source: string
          username: string
        }[]
      }
      fetch_pending_targets: {
        Args: { p_ig_account_id: string; p_limit?: number }
        Returns: {
          campaign_id: string | null
          created_at: string | null
          details: Json | null
          device_id: string | null
          id: string
          ig_account_id: string
          priority: number | null
          processed_at: string | null
          source: string | null
          status: string | null
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "target_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_bridge_token: {
        Args: { p_ig_account_id: string }
        Returns: string
      }
      get_dashboard_summary: {
        Args: { p_ig_account_id: string }
        Returns: Json
      }
      get_rate_limits: { Args: { p_user_id: string }; Returns: Json }
      get_today_actions: {
        Args: { p_ig_account_id: string }
        Returns: {
          action_type: string
          count: number
        }[]
      }
      mark_targets_done: {
        Args: { p_ig_account_id: string; p_target_ids: string[] }
        Returns: number
      }
      remove_duplicate_targets: {
        Args: { p_ig_account_id: string }
        Returns: number
      }
      send_bot_command: {
        Args: { p_command: string; p_ig_account_id: string; p_params: Json }
        Returns: string
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
