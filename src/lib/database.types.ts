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
          excluded_sources: number;
          is_valid: boolean;
          platform: string | null;
          steps: number;
          synced_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          excluded_sources?: number;
          is_valid: boolean;
          platform?: string | null;
          steps: number;
          synced_at?: string;
          user_id: string;
        };
        Update: {
          date?: string;
          excluded_sources?: number;
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
          appeal_accepted: boolean;
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
          appeal_accepted?: boolean;
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
          appeal_accepted?: boolean;
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
      appeals: {
        Row: {
          created_at: string;
          id: string;
          message: string;
          resolution_note: string | null;
          resolved_at: string | null;
          status: string;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          message: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: string;
          user_id: string;
          workout_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          message?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          status?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appeals_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appeals_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: true;
            referencedRelation: 'activity_workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      challenge_feed: {
        Row: {
          challenge_id: string;
          created_at: string;
          distance_m: number | null;
          id: string;
          kind: string;
          ref_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          kind: string;
          ref_id?: string | null;
          user_id: string;
        };
        Update: {
          challenge_id?: string;
          created_at?: string;
          distance_m?: number | null;
          id?: string;
          kind?: string;
          ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'challenge_feed_challenge_id_fkey';
            columns: ['challenge_id'];
            isOneToOne: false;
            referencedRelation: 'challenges';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'challenge_feed_user_id_fkey';
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
          donate: boolean | null;
          donated_cents: number;
          id: string;
          joined_at: string;
          ngo_id: string | null;
          payout_cents: number | null;
          progress_value: number;
          rank: number | null;
          rank_points: number;
          result: string;
          stake_cents: number;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          challenge_id: string;
          donate?: boolean | null;
          donated_cents?: number;
          id?: string;
          joined_at?: string;
          ngo_id?: string | null;
          payout_cents?: number | null;
          progress_value?: number;
          rank?: number | null;
          rank_points?: number;
          result?: string;
          stake_cents: number;
          user_id?: string | null;
        };
        Update: {
          challenge_id?: string;
          donate?: boolean | null;
          donated_cents?: number;
          id?: string;
          joined_at?: string;
          ngo_id?: string | null;
          payout_cents?: number | null;
          progress_value?: number;
          rank?: number | null;
          rank_points?: number;
          result?: string;
          stake_cents?: number;
          user_id?: string | null;
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
            foreignKeyName: 'challenge_participants_ngo_id_fkey';
            columns: ['ngo_id'];
            isOneToOne: false;
            referencedRelation: 'ngos';
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
          creator_id: string | null;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          mode: string;
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
          weekly_key: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          creator_id?: string | null;
          ends_at: string;
          fee_bps?: number;
          goal_type: string;
          id?: string;
          invite_code?: string | null;
          max_participants?: number | null;
          min_participants?: number;
          mode?: string;
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
          weekly_key?: string | null;
        };
        Update: {
          created_at?: string;
          creator_id?: string | null;
          ends_at?: string;
          fee_bps?: number;
          goal_type?: string;
          id?: string;
          invite_code?: string | null;
          max_participants?: number | null;
          min_participants?: number;
          mode?: string;
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
          weekly_key?: string | null;
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
      feed_cheers: {
        Row: {
          created_at: string;
          feed_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feed_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          feed_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'feed_cheers_feed_id_fkey';
            columns: ['feed_id'];
            isOneToOne: false;
            referencedRelation: 'challenge_feed';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'feed_cheers_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      friendships: {
        Row: {
          addressee_id: string;
          created_at: string;
          id: string;
          requester_id: string;
          responded_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          addressee_id: string;
          created_at?: string;
          id?: string;
          requester_id: string;
          responded_at?: string | null;
          status?: string;
        };
        Update: {
          addressee_id?: string;
          created_at?: string;
          id?: string;
          requester_id?: string;
          responded_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_addressee_id_fkey';
            columns: ['addressee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_requester_id_fkey';
            columns: ['requester_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      gps_runs: {
        Row: {
          base_reason: string | null;
          client_run_id: string;
          created_at: string;
          distance_m: number;
          duration_s: number;
          ended_at: string;
          id: string;
          jump_count: number;
          mocked_count: number;
          point_count: number;
          route: NonNullable<Json>;
          started_at: string;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          base_reason?: string | null;
          client_run_id: string;
          created_at?: string;
          distance_m: number;
          duration_s: number;
          ended_at: string;
          id?: string;
          jump_count: number;
          mocked_count: number;
          point_count: number;
          route: NonNullable<Json>;
          started_at: string;
          user_id: string;
          workout_id: string;
        };
        Update: {
          base_reason?: string | null;
          client_run_id?: string;
          created_at?: string;
          distance_m?: number;
          duration_s?: number;
          ended_at?: string;
          id?: string;
          jump_count?: number;
          mocked_count?: number;
          point_count?: number;
          route?: NonNullable<Json>;
          started_at?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gps_runs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gps_runs_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'activity_workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          joined_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          joined_at?: string;
          user_id: string;
        };
        Update: {
          group_id?: string;
          joined_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      groups: {
        Row: {
          created_at: string;
          id: string;
          invite_code: string;
          name: string;
          owner_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          invite_code: string;
          name: string;
          owner_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          invite_code?: string;
          name?: string;
          owner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'groups_owner_id_fkey';
            columns: ['owner_id'];
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
          ngo_id: string | null;
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
          ngo_id?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          account?: string;
          amount_cents?: number;
          challenge_id?: string | null;
          created_at?: string;
          id?: string;
          ngo_id?: string | null;
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
            foreignKeyName: 'ledger_entries_ngo_id_fkey';
            columns: ['ngo_id'];
            isOneToOne: false;
            referencedRelation: 'ngos';
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
      ngos: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          anonymous_in_rankings: boolean;
          avatar_path: string | null;
          created_at: string;
          default_ngo_id: string | null;
          display_name: string;
          donate_default: boolean;
          friend_code: string;
          id: string;
          onboarded_at: string | null;
          push_cheers: boolean;
          push_friends: boolean;
          push_results: boolean;
          share_runs_with_friends: boolean;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          anonymous_in_rankings?: boolean;
          avatar_path?: string | null;
          created_at?: string;
          default_ngo_id?: string | null;
          display_name: string;
          donate_default?: boolean;
          friend_code?: string;
          id: string;
          onboarded_at?: string | null;
          push_cheers?: boolean;
          push_friends?: boolean;
          push_results?: boolean;
          share_runs_with_friends?: boolean;
          timezone?: string;
        };
        Update: {
          anonymous_in_rankings?: boolean;
          avatar_path?: string | null;
          created_at?: string;
          default_ngo_id?: string | null;
          display_name?: string;
          donate_default?: boolean;
          friend_code?: string;
          id?: string;
          onboarded_at?: string | null;
          push_cheers?: boolean;
          push_friends?: boolean;
          push_results?: boolean;
          share_runs_with_friends?: boolean;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_default_ngo_id_fkey';
            columns: ['default_ngo_id'];
            isOneToOne: false;
            referencedRelation: 'ngos';
            referencedColumns: ['id'];
          },
        ];
      };
      push_outbox: {
        Row: {
          body: string;
          created_at: string;
          data: NonNullable<Json>;
          error: string | null;
          id: string;
          kind: string;
          sent_at: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          data?: NonNullable<Json>;
          error?: string | null;
          id?: string;
          kind: string;
          sent_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          data?: NonNullable<Json>;
          error?: string | null;
          id?: string;
          kind?: string;
          sent_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_outbox_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string;
          platform: string;
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      run_comments: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          user_id: string;
          workout_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'run_comments_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'run_comments_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'activity_workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      run_kudos: {
        Row: {
          created_at: string;
          user_id: string;
          workout_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
          workout_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          workout_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'run_kudos_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'run_kudos_workout_id_fkey';
            columns: ['workout_id'];
            isOneToOne: false;
            referencedRelation: 'activity_workouts';
            referencedColumns: ['id'];
          },
        ];
      };
      user_badges: {
        Row: {
          awarded_at: string;
          badge: string;
          seen_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          awarded_at?: string;
          badge: string;
          seen_at?: string | null;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          badge?: string;
          seen_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_badges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
      add_run_comment: { Args: { p_body: string; p_workout_id: string }; Returns: string };
      advance_challenges: { Args: Record<PropertyKey, never>; Returns: number };
      cheer_feed_entry: { Args: { p_feed_id: string }; Returns: number };
      claim_secret_badge: { Args: { p_secret: string }; Returns: undefined };
      create_challenge: {
        Args: {
          p_duration_days: number;
          p_goal_type: string;
          p_max_participants?: number;
          p_mode?: string;
          p_stake_cents: number;
          p_start_date: string;
          p_target_value: number;
          p_title: string;
          p_visibility: string;
        };
        Returns: {
          created_at: string;
          creator_id: string | null;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          mode: string;
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
          weekly_key: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'challenges';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_goal: {
        Args: {
          p_goal_type: string;
          p_period: string;
          p_stake_cents: number;
          p_target_value: number;
          p_title: string;
        };
        Returns: {
          created_at: string;
          creator_id: string | null;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          mode: string;
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
          weekly_key: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'challenges';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_scheduled_goal: {
        Args: {
          p_goal_type: string;
          p_start_date: string;
          p_end_date: string;
          p_with_friends: boolean;
          p_stake_cents: number;
          p_target_value: number;
          p_title: string;
        };
        Returns: {
          created_at: string;
          creator_id: string | null;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          mode: string;
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
          weekly_key: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'challenges';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_group: {
        Args: { p_name: string };
        Returns: {
          created_at: string;
          id: string;
          invite_code: string;
          name: string;
          owner_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'groups';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_ranked_cycles: { Args: { p_now?: string }; Returns: number };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      delete_run_comment: { Args: { p_comment_id: string }; Returns: undefined };
      export_my_data: { Args: { p_include_routes?: boolean }; Returns: Json };
      get_challenge_by_code: {
        Args: { p_code: string };
        Returns: {
          created_at: string;
          creator_id: string | null;
          ends_at: string;
          fee_bps: number;
          goal_type: string;
          id: string;
          invite_code: string | null;
          max_participants: number | null;
          min_participants: number;
          mode: string;
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
          weekly_key: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'challenges';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_challenge_feed: {
        Args: { p_challenge_id: string; p_limit?: number };
        Returns: {
          cheer_count: number;
          cheered_by_me: boolean;
          created_at: string;
          display_name: string;
          distance_m: number;
          id: string;
          is_mine: boolean;
          kind: string;
        }[];
      };
      get_friend_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          display_name: string;
          id: string;
        }[];
      };
      get_friend_runs: {
        Args: { p_limit?: number };
        Returns: {
          comment_count: number;
          display_name: string;
          distance_m: number;
          duration_s: number;
          is_mine: boolean;
          kudos_by_me: boolean;
          kudos_count: number;
          start_at: string;
          user_id: string;
          workout_id: string;
        }[];
      };
      get_goal_window: {
        Args: { p_challenge_id: string };
        Returns: {
          goals: number;
          stakes_cents: number;
        }[];
      };
      get_gps_run_profile: {
        Args: { p_run_id: string };
        Returns: {
          altitude_m: number;
          distance_m: number;
          pace_s_per_km: number;
        }[];
      };
      get_gps_run_route: {
        Args: { p_run_id: string };
        Returns: {
          lat: number;
          lng: number;
          segment: number;
          seq: number;
        }[];
      };
      get_gps_run_splits: {
        Args: { p_run_id: string };
        Returns: {
          ascent_m: number;
          distance_m: number;
          km: number;
          pace_s_per_km: number;
          seconds: number;
        }[];
      };
      get_group_board: {
        Args: { p_group_id: string; p_period?: string };
        Returns: {
          display_name: string;
          distance_m: number;
          is_me: boolean;
          rank: number;
          runs: number;
        }[];
      };
      get_leaderboard: {
        Args: { p_challenge_id: string };
        Returns: {
          display_name: string;
          goal_reached: boolean;
          is_me: boolean;
          rank: number;
          user_id: string;
        }[];
      };
      get_my_challenge_donation: {
        Args: { p_challenge_id: string };
        Returns: {
          donate: boolean;
          effective_donate: boolean;
          effective_ngo_id: string;
          ngo_id: string;
        }[];
      };
      get_my_challenge_result: {
        Args: { p_challenge_id: string };
        Returns: {
          donated_cents: number;
          payout_cents: number;
          rank: number;
          rank_points: number;
        }[];
      };
      get_my_donation_totals: {
        Args: Record<PropertyKey, never>;
        Returns: {
          donations: number;
          ngo_id: string;
          ngo_name: string;
          total_cents: number;
        }[];
      };
      get_my_donations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          amount_cents: number;
          challenge_id: string;
          created_at: string;
          ngo_id: string;
          ngo_name: string;
          title: string;
        }[];
      };
      get_my_friend_code: { Args: Record<PropertyKey, never>; Returns: string };
      get_my_friends: {
        Args: Record<PropertyKey, never>;
        Returns: {
          display_name: string;
          user_id: string;
        }[];
      };
      get_my_gps_run_appeals: {
        Args: Record<PropertyKey, never>;
        Returns: {
          resolution_note: string;
          run_id: string;
          status: string;
        }[];
      };
      get_my_gps_runs: {
        Args: { p_limit?: number };
        Returns: {
          distance_m: number;
          duration_s: number;
          ended_at: string;
          has_route: boolean;
          id: string;
          invalid_reason: string;
          is_valid: boolean;
          started_at: string;
        }[];
      };
      get_my_groups: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          invite_code: string;
          member_count: number;
          name: string;
        }[];
      };
      get_my_level: {
        Args: Record<PropertyKey, never>;
        Returns: {
          level: number;
          level_start_points: number;
          next_level_points: number;
          points: number;
        }[];
      };
      get_my_period_stats: {
        Args: { p_count?: number; p_unit: string };
        Returns: {
          distance_m: number;
          duration_s: number;
          period_start: string;
          runs: number;
        }[];
      };
      get_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: {
          anonymous_in_rankings: boolean;
          avatar_path: string | null;
          created_at: string;
          default_ngo_id: string | null;
          display_name: string;
          donate_default: boolean;
          friend_code: string;
          id: string;
          onboarded_at: string | null;
          push_cheers: boolean;
          push_friends: boolean;
          push_results: boolean;
          share_runs_with_friends: boolean;
          timezone: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_my_progress: {
        Args: Record<PropertyKey, never>;
        Returns: {
          challenge_id: string;
          progress_value: number;
        }[];
      };
      get_my_records: {
        Args: Record<PropertyKey, never>;
        Returns: {
          achieved_at: string;
          kind: string;
          value: number;
        }[];
      };
      get_my_run_shapes: {
        Args: { p_limit?: number };
        Returns: {
          run_id: string;
          shape: Json;
        }[];
      };
      get_my_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          streak_days: number;
          total_distance_m: number;
          total_won_cents: number;
          wins: number;
        }[];
      };
      get_my_week: {
        Args: Record<PropertyKey, never>;
        Returns: {
          day: string;
          distance_m: number;
        }[];
      };
      get_pool_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          bound_cents: number;
          goals: number;
          people: number;
        }[];
      };
      get_potential_win: { Args: { p_challenge_id: string }; Returns: number };
      get_run_comments: {
        Args: { p_workout_id: string };
        Returns: {
          body: string;
          created_at: string;
          display_name: string;
          id: string;
          is_mine: boolean;
        }[];
      };
      get_season_board: {
        Args: { p_limit?: number };
        Returns: {
          display_name: string;
          is_me: boolean;
          points: number;
          rank: number;
        }[];
      };
      give_kudos: { Args: { p_workout_id: string }; Returns: undefined };
      join_challenge: {
        Args: { p_challenge_id: string; p_stake_cents?: number };
        Returns: {
          challenge_id: string;
          donate: boolean | null;
          donated_cents: number;
          id: string;
          joined_at: string;
          ngo_id: string | null;
          payout_cents: number | null;
          progress_value: number;
          rank: number | null;
          rank_points: number;
          result: string;
          stake_cents: number;
          user_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'challenge_participants';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_challenge_by_code: {
        Args: { p_code: string; p_stake_cents?: number };
        Returns: {
          challenge_id: string;
          donate: boolean | null;
          donated_cents: number;
          id: string;
          joined_at: string;
          ngo_id: string | null;
          payout_cents: number | null;
          progress_value: number;
          rank: number | null;
          rank_points: number;
          result: string;
          stake_cents: number;
          user_id: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'challenge_participants';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      join_group: { Args: { p_code: string }; Returns: string };
      leave_challenge: { Args: { p_challenge_id: string }; Returns: number };
      leave_group: { Args: { p_group_id: string }; Returns: undefined };
      mark_badge_seen: { Args: { p_badge: string }; Returns: undefined };
      recompute_progress: { Args: { p_challenge_id: string }; Returns: undefined };
      register_push_token: { Args: { p_platform: string; p_token: string }; Returns: undefined };
      remove_friend: { Args: { p_user_id: string }; Returns: undefined };
      respond_friend_request: {
        Args: { p_accept: boolean; p_friendship_id: string };
        Returns: undefined;
      };
      send_friend_request: { Args: { p_code: string }; Returns: string };
      set_avatar_path: { Args: { p_path?: string }; Returns: undefined };
      set_challenge_donation: {
        Args: { p_challenge_id: string; p_donate?: boolean; p_ngo_id?: string };
        Returns: undefined;
      };
      set_display_name: {
        Args: { p_display_name: string };
        Returns: {
          anonymous_in_rankings: boolean;
          avatar_path: string | null;
          created_at: string;
          default_ngo_id: string | null;
          display_name: string;
          donate_default: boolean;
          friend_code: string;
          id: string;
          onboarded_at: string | null;
          push_cheers: boolean;
          push_friends: boolean;
          push_results: boolean;
          share_runs_with_friends: boolean;
          timezone: string;
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_donation_defaults: { Args: { p_donate: boolean; p_ngo_id?: string }; Returns: undefined };
      set_push_preferences: {
        Args: { p_cheers: boolean; p_friends: boolean; p_results: boolean };
        Returns: undefined;
      };
      set_ranking_visibility: { Args: { p_anonymous: boolean }; Returns: undefined };
      set_share_runs: { Args: { p_share: boolean }; Returns: undefined };
      settle_challenge: { Args: { p_challenge_id: string }; Returns: boolean };
      submit_appeal: {
        Args: { p_message: string; p_workout_id: string };
        Returns: {
          created_at: string;
          id: string;
          message: string;
          resolution_note: string | null;
          resolved_at: string | null;
          status: string;
          user_id: string;
          workout_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'appeals';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_gps_run_appeal: {
        Args: { p_message: string; p_run_id: string };
        Returns: {
          created_at: string;
          id: string;
          message: string;
          resolution_note: string | null;
          resolved_at: string | null;
          status: string;
          user_id: string;
          workout_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'appeals';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      sync_daily_steps: { Args: { p_days: Json }; Returns: number };
      sync_gps_run: {
        Args: { p_run: Json };
        Returns: {
          distance_m: number;
          duration_s: number;
          invalid_reason: string;
          is_valid: boolean;
          run_id: string;
        }[];
      };
      sync_workouts: { Args: { p_workouts: Json }; Returns: number };
      unregister_push_token: { Args: { p_token: string }; Returns: undefined };
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
