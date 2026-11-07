export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      a2p_agency_members: {
        Row: {
          authorized: boolean;
          authorized_by: string;
          reason: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          authorized?: boolean;
          authorized_by: string;
          reason: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          authorized?: boolean;
          authorized_by?: string;
          reason?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_agency_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      a2p_agency_profile: {
        Row: {
          ciphertext: string;
          id: string;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          ciphertext: string;
          id?: string;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          ciphertext?: string;
          id?: string;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      a2p_audit: {
        Row: {
          actor_id: string;
          created_at: string;
          detail: string | null;
          event: string;
          id: string;
          registration_id: string | null;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          detail?: string | null;
          event: string;
          id?: string;
          registration_id?: string | null;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          detail?: string | null;
          event?: string;
          id?: string;
          registration_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_audit_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: false;
            referencedRelation: "a2p_registrations";
            referencedColumns: ["id"];
          },
        ];
      };
      a2p_capability_cache: {
        Row: {
          allowed: boolean;
          blocker: string | null;
          checked_at: string;
          enums: Json;
          id: string;
        };
        Insert: {
          allowed?: boolean;
          blocker?: string | null;
          checked_at?: string;
          enums?: Json;
          id?: string;
        };
        Update: {
          allowed?: boolean;
          blocker?: string | null;
          checked_at?: string;
          enums?: Json;
          id?: string;
        };
        Relationships: [];
      };
      a2p_correction_requests: {
        Row: {
          created_at: string;
          id: string;
          request: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          request: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          request?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_correction_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      a2p_fee_schedule: {
        Row: {
          brand_fee: number;
          campaign_review_fee: number;
          confirmed_at: string;
          confirmed_by: string;
          currency: string;
          id: string;
          source: string;
        };
        Insert: {
          brand_fee: number;
          campaign_review_fee: number;
          confirmed_at?: string;
          confirmed_by: string;
          currency?: string;
          id?: string;
          source: string;
        };
        Update: {
          brand_fee?: number;
          campaign_review_fee?: number;
          confirmed_at?: string;
          confirmed_by?: string;
          currency?: string;
          id?: string;
          source?: string;
        };
        Relationships: [];
      };
      a2p_number_links: {
        Row: {
          campaign_id: string;
          phone_number: string;
          registration_id: string;
          status: string;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
        };
        Insert: {
          campaign_id: string;
          phone_number: string;
          registration_id: string;
          status?: string;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          campaign_id?: string;
          phone_number?: string;
          registration_id?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_number_links_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: false;
            referencedRelation: "a2p_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "a2p_number_links_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      a2p_operations: {
        Row: {
          actor_id: string;
          authorized_at: string;
          completed_at: string | null;
          detail: string | null;
          fee_snapshot: Json | null;
          id: string;
          kind: string;
          provider_id: string | null;
          registration_id: string;
          state: string;
        };
        Insert: {
          actor_id: string;
          authorized_at?: string;
          completed_at?: string | null;
          detail?: string | null;
          fee_snapshot?: Json | null;
          id?: string;
          kind: string;
          provider_id?: string | null;
          registration_id: string;
          state?: string;
        };
        Update: {
          actor_id?: string;
          authorized_at?: string;
          completed_at?: string | null;
          detail?: string | null;
          fee_snapshot?: Json | null;
          id?: string;
          kind?: string;
          provider_id?: string | null;
          registration_id?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_operations_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: false;
            referencedRelation: "a2p_registrations";
            referencedColumns: ["id"];
          },
        ];
      };
      a2p_private: {
        Row: {
          ciphertext: string;
          registration_id: string;
          updated_at: string;
        };
        Insert: {
          ciphertext: string;
          registration_id: string;
          updated_at?: string;
        };
        Update: {
          ciphertext?: string;
          registration_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_private_registration_id_fkey";
            columns: ["registration_id"];
            isOneToOne: true;
            referencedRelation: "a2p_registrations";
            referencedColumns: ["id"];
          },
        ];
      };
      a2p_public_form_verification: {
        Row: {
          disclosure_version: string;
          id: string;
          profile_updated_at: string | null;
          source: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          disclosure_version?: string;
          id?: string;
          profile_updated_at?: string | null;
          source?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          disclosure_version?: string;
          id?: string;
          profile_updated_at?: string | null;
          source?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      a2p_rate_limits: {
        Row: {
          action: string;
          last_at: string;
          user_id: string;
        };
        Insert: {
          action: string;
          last_at?: string;
          user_id: string;
        };
        Update: {
          action?: string;
          last_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      a2p_registrations: {
        Row: {
          agency_registration_id: string | null;
          blocker: string | null;
          brand_id: string | null;
          brand_status: string;
          campaign_id: string | null;
          campaign_status: string;
          created_at: string;
          display_name: string;
          id: string;
          relationship: string;
          stage: string;
          submitted_at: string | null;
          suspended: boolean;
          synced_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agency_registration_id?: string | null;
          blocker?: string | null;
          brand_id?: string | null;
          brand_status?: string;
          campaign_id?: string | null;
          campaign_status?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          relationship?: string;
          stage?: string;
          submitted_at?: string | null;
          suspended?: boolean;
          synced_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agency_registration_id?: string | null;
          blocker?: string | null;
          brand_id?: string | null;
          brand_status?: string;
          campaign_id?: string | null;
          campaign_status?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          relationship?: string;
          stage?: string;
          submitted_at?: string | null;
          suspended?: boolean;
          synced_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "a2p_registrations_agency_registration_id_fkey";
            columns: ["agency_registration_id"];
            isOneToOne: false;
            referencedRelation: "a2p_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "a2p_registrations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_private: {
        Row: {
          dl_number: string | null;
          dl_state: string | null;
          dob: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          dl_number?: string | null;
          dl_state?: string | null;
          dob?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          dl_number?: string | null;
          dl_state?: string | null;
          dob?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      call_logs: {
        Row: {
          call_control_id: string | null;
          created_at: string;
          duration_seconds: number | null;
          id: string;
          lead_id: string | null;
          notes: string | null;
          outcome: string | null;
          user_id: string;
        };
        Insert: {
          call_control_id?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          lead_id?: string | null;
          notes?: string | null;
          outcome?: string | null;
          user_id: string;
        };
        Update: {
          call_control_id?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          id?: string;
          lead_id?: string | null;
          notes?: string | null;
          outcome?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      invites: {
        Row: {
          claimed_at: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          invited_by: string | null;
          licensed_states: string[];
          npn: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          claimed_at?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          licensed_states?: string[];
          npn?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          claimed_at?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          invited_by?: string | null;
          licensed_states?: string[];
          npn?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
      leads: {
        Row: {
          address: string | null;
          city: string | null;
          created_at: string;
          data: Json;
          dials: number;
          email: string | null;
          first_name: string | null;
          follow_at: string | null;
          follow_what: string | null;
          id: string;
          last_dial: string | null;
          last_name: string | null;
          lead_date: string | null;
          lead_source: string | null;
          lead_type: string;
          log: Json;
          orig: Json;
          phone: string | null;
          phone_digits: string | null;
          sample: boolean;
          sms_opt_out: boolean;
          stage_at: Json;
          state: string | null;
          status: string;
          step: number;
          updated_at: string;
          user_id: string;
          verify: Json;
          zip: string | null;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          data?: Json;
          dials?: number;
          email?: string | null;
          first_name?: string | null;
          follow_at?: string | null;
          follow_what?: string | null;
          id?: string;
          last_dial?: string | null;
          last_name?: string | null;
          lead_date?: string | null;
          lead_source?: string | null;
          lead_type?: string;
          log?: Json;
          orig?: Json;
          phone?: string | null;
          phone_digits?: string | null;
          sample?: boolean;
          sms_opt_out?: boolean;
          stage_at?: Json;
          state?: string | null;
          status?: string;
          step?: number;
          updated_at?: string;
          user_id: string;
          verify?: Json;
          zip?: string | null;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          created_at?: string;
          data?: Json;
          dials?: number;
          email?: string | null;
          first_name?: string | null;
          follow_at?: string | null;
          follow_what?: string | null;
          id?: string;
          last_dial?: string | null;
          last_name?: string | null;
          lead_date?: string | null;
          lead_source?: string | null;
          lead_type?: string;
          log?: Json;
          orig?: Json;
          phone?: string | null;
          phone_digits?: string | null;
          sample?: boolean;
          sms_opt_out?: boolean;
          stage_at?: Json;
          state?: string | null;
          status?: string;
          step?: number;
          updated_at?: string;
          user_id?: string;
          verify?: Json;
          zip?: string | null;
        };
        Relationships: [];
      };
      phone_numbers: {
        Row: {
          created_at: string;
          friendly_name: string | null;
          id: string;
          is_primary: boolean;
          phone_number: string;
          region: string | null;
          sms: boolean;
          telnyx_id: string | null;
          user_id: string;
          voice: boolean;
        };
        Insert: {
          created_at?: string;
          friendly_name?: string | null;
          id?: string;
          is_primary?: boolean;
          phone_number: string;
          region?: string | null;
          sms?: boolean;
          telnyx_id?: string | null;
          user_id: string;
          voice?: boolean;
        };
        Update: {
          created_at?: string;
          friendly_name?: string | null;
          id?: string;
          is_primary?: boolean;
          phone_number?: string;
          region?: string | null;
          sms?: boolean;
          telnyx_id?: string | null;
          user_id?: string;
          voice?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          intake_key: string;
          is_active: boolean;
          licensed_states: string[];
          npn: string | null;
          phone: string | null;
          profile: Json;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          intake_key?: string;
          is_active?: boolean;
          licensed_states?: string[];
          npn?: string | null;
          phone?: string | null;
          profile?: Json;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          intake_key?: string;
          is_active?: boolean;
          licensed_states?: string[];
          npn?: string | null;
          phone?: string | null;
          profile?: Json;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      sms_consent_events: {
        Row: {
          created_at: string;
          disclosure: string;
          disclosure_version: string;
          id: string;
          marketing: boolean;
          phone_number: string;
          request_id: string;
          source: string;
          transactional: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          disclosure: string;
          disclosure_version: string;
          id?: string;
          marketing?: boolean;
          phone_number: string;
          request_id: string;
          source: string;
          transactional?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          disclosure?: string;
          disclosure_version?: string;
          id?: string;
          marketing?: boolean;
          phone_number?: string;
          request_id?: string;
          source?: string;
          transactional?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_consent_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sms_keyword_responses: {
        Row: {
          created_at: string;
          event_id: string;
          state: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          state?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          state?: string;
        };
        Relationships: [];
      };
      sms_messages: {
        Row: {
          body: string | null;
          created_at: string;
          direction: string;
          from_number: string | null;
          id: string;
          lead_id: string | null;
          status: string;
          telnyx_message_id: string | null;
          to_number: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          direction: string;
          from_number?: string | null;
          id?: string;
          lead_id?: string | null;
          status?: string;
          telnyx_message_id?: string | null;
          to_number?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          direction?: string;
          from_number?: string | null;
          id?: string;
          lead_id?: string | null;
          status?: string;
          telnyx_message_id?: string | null;
          to_number?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      sms_suppressions: {
        Row: {
          phone_number: string;
          suppressed: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          phone_number: string;
          suppressed?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          phone_number?: string;
          suppressed?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sms_suppressions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      telephony_configs: {
        Row: {
          auto_log_call: boolean;
          bridge_phone: string | null;
          calling_mode: string;
          primary_caller_id: string | null;
          record_calls: boolean;
          sip_username: string | null;
          telnyx_credential_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auto_log_call?: boolean;
          bridge_phone?: string | null;
          calling_mode?: string;
          primary_caller_id?: string | null;
          record_calls?: boolean;
          sip_username?: string | null;
          telnyx_credential_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auto_log_call?: boolean;
          bridge_phone?: string | null;
          calling_mode?: string;
          primary_caller_id?: string | null;
          record_calls?: boolean;
          sip_username?: string | null;
          telnyx_credential_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          event_id: string;
          event_type: string | null;
          received_at: string;
        };
        Insert: {
          event_id: string;
          event_type?: string | null;
          received_at?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      a2p_take_rate_limit: {
        Args: { p_action: string; p_seconds: number; p_user: string };
        Returns: boolean;
      };
      claim_access: { Args: never; Returns: boolean };
      grant_access_for: {
        Args: { _email: string; _uid: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "agent";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "agent"],
    },
  },
} as const;
