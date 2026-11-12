export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_daily_steps: {
        Row: {
          date: string;
          is_valid: boolean;
          platform: string | null;
          steps: number;
          synced_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          is_valid: boolean;
          platform?: string | null;
          steps: number;
          synced_at?: string;
          user_id: string;
        };
        Update: {
          date?: string;
          is_valid?: boolean;
          platform?: string | null;
          steps?: number;
          synced_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_daily_steps_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      activity_workouts: {
        Row: {
          activity_type: string;
          distance_m: number;
          duration_s: number;
          end_at: string;
          id: string;
          invalid_reason: string | null;
          is_valid: boolean;
          platform: string;
          source_name: string | null;
          source_record_id: string;
          start_at: string;
          synced_at: string;
          user_id: string;
          was_user_entered: boolean;
        };
        ComputedFields: never;
        Insert: {
          activity_type: string;
          distance_m: number;
          duration_s: number;
          end_at: string;
          id?: string;
          invalid_reason?: string | null;
          is_valid: boolean;
          platform: string;
          source_name?: string | null;
          source_record_id: string;
          start_at: string;
          synced_at?: string;
          user_id: string;
          was_user_entered: boolean;
        };
        Update: {
          activity_type?: string;
          distance_m?: number;
          duration_s?: number;
          end_at?: string;
          id?: string;
          invalid_reason?: string | null;
          is_valid?: boolean;
          platform?: string;
          source_name?: string | null;
          source_record_id?: string;
          start_at?: string;
          synced_at?: string;
          user_id?: string;
          was_user_entered?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'activity_workouts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      challenge_participants: {
        Row: {
          challenge_id: string;
          joined_at: string;
          payout_cents: number | null;
          progress_value: number;
          result: string;
          stake_cents: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          joined_at?: string;
          payout_cents?: number | null;
          progress_value?: number;
          result?: string;
          stake_cents: number;
          user_id: string;
        };
        Update: {
          challenge_id?: string;
          joined_at?: string;
          payout_cents?: number | null;
          progress_value?: number;
          result?: string;
          stake_cents?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'challenge_participants_challenge_id_fkey';
            columns: ['challenge_id'];
            isOneToOne: false;
            referencedRelation: 'challenges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'challenge_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      challenges: {
        Row: {
          created_at: string;
          creator_id: string;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          participant_count: number;
          pot_cents: number | null;
          settled_at: string | null;
          stake_cents: number;
          starts_at: string;
          status: string;
          sync_grace_hours: number;
          target_value: number;
          timezone: string;
          title: string;
          visibility: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          creator_id: string;
          ends_at: string;
          fee_bps?: number;
          goal_type: string;
          id?: string;
          invite_code?: string | null;
          max_participants?: number | null;
          min_participants?: number;
          participant_count?: number;
          pot_cents?: never;
          settled_at?: string | null;
          stake_cents: number;
          starts_at: string;
          status?: string;
          sync_grace_hours?: number;
          target_value: number;
          timezone?: string;
          title: string;
          visibility: string;
        };
        Update: {
          created_at?: string;
          creator_id?: string;
          ends_at?: string;
          fee_bps?: number;
          goal_type?: string;
          id?: string;
          invite_code?: string | null;
          max_participants?: number | null;
          min_participants?: number;
          participant_count?: number;
          pot_cents?: never;
          settled_at?: string | null;
          stake_cents?: number;
          starts_at?: string;
          status?: string;
          sync_grace_hours?: number;
          target_value?: number;
          timezone?: string;
          title?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'challenges_creator_id_fkey';
            columns: ['creator_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account: string;
          amount_cents: number;
          challenge_id: string | null;
          created_at: string;
          id: string;
          type: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          account: string;
          amount_cents: number;
          challenge_id?: string | null;
          created_at?: string;
          id?: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          account?: string;
          amount_cents?: number;
          challenge_id?: string | null;
          created_at?: string;
          id?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ledger_entries_challenge_id_fkey';
            columns: ['challenge_id'];
            isOneToOne: false;
            referencedRelation: 'challenges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ledger_entries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          onboarded_at: string | null;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          onboarded_at?: string | null;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          onboarded_at?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          balance_cents: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          balance_cents?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance_cents?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'wallets_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_challenge: {
        Args: {
          p_duration_days: number;
          p_goal_type: string;
          p_max_participants?: number;
          p_stake_cents: number;
          p_start_date: string;
          p_target_value: number;
          p_title: string;
          p_visibility: string;
        };
        Returns: {
          created_at: string;
          creator_id: string;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          participant_count: number;
          pot_cents: number | null;
          settled_at: string | null;
          stake_cents: number;
          starts_at: string;
          status: string;
          sync_grace_hours: number;
          target_value: number;
          timezone: string;
          title: string;
          visibility: string;
        };
        SetofOptions: {
          from: '*';
          to: 'challenges';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_challenge_by_code: {
        Args: { p_code: string };
        Returns: {
          created_at: string;
          creator_id: string;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          participant_count: number;
          pot_cents: number | null;
          settled_at: string | null;
          stake_cents: number;
          starts_at: string;
          status: string;
          sync_grace_hours: number;
          target_value: number;
          timezone: string;
          title: string;
          visibility: string;
        };
        SetofOptions: {
          from: '*';
          to: 'challenges';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          display_name: string;
          id: string;
          onboarded_at: string | null;
          timezone: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_challenge: {
        Args: { p_challenge_id: string };
        Returns: {
          challenge_id: string;
          joined_at: string;
          payout_cents: number | null;
          progress_value: number;
          result: string;
          stake_cents: number;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'challenge_participants';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_challenge_by_code: {
        Args: { p_code: string };
        Returns: {
          challenge_id: string;
          joined_at: string;
          payout_cents: number | null;
          progress_value: number;
          result: string;
          stake_cents: number;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'challenge_participants';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      leave_challenge: {
        Args: { p_challenge_id: string };
        Returns: {
          account: string;
          amount_cents: number;
          challenge_id: string | null;
          created_at: string;
          id: string;
          type: string;
          user_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'ledger_entries';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_display_name: {
        Args: { p_display_name: string };
        Returns: {
          created_at: string;
          display_name: string;
          id: string;
          onboarded_at: string | null;
          timezone: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
