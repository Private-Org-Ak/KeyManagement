export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      doors: {
        Row: {
          created_at: string
          door_type: Database['public']['Enums']['door_type']
          floor: string | null
          household_id: string
          id: string
          name: string
          notes: string | null
          room_group: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          door_type?: Database['public']['Enums']['door_type']
          floor?: string | null
          household_id: string
          id?: string
          name: string
          notes?: string | null
          room_group?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          door_type?: Database['public']['Enums']['door_type']
          floor?: string | null
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          room_group?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'doors_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          household_id: string
          id: string
          role: Database['public']['Enums']['member_role']
          used_at: string | null
          used_by: string | null
        }
        ComputedFields: never
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          household_id: string
          id?: string
          role?: Database['public']['Enums']['member_role']
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          role?: Database['public']['Enums']['member_role']
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invites_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      keys: {
        Row: {
          created_at: string
          door_id: string | null
          holder: string | null
          household_id: string
          id: string
          key_number: string
          key_number_normalized: string | null
          label: string | null
          photo_path: string | null
          tag_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          door_id?: string | null
          holder?: string | null
          household_id: string
          id?: string
          key_number: string
          key_number_normalized?: never
          label?: string | null
          photo_path?: string | null
          tag_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          door_id?: string | null
          holder?: string | null
          household_id?: string
          id?: string
          key_number?: string
          key_number_normalized?: never
          label?: string | null
          photo_path?: string | null
          tag_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'keys_door_id_household_id_fkey'
            columns: ['door_id', 'household_id']
            isOneToOne: false
            referencedRelation: 'doors'
            referencedColumns: ['id', 'household_id']
          },
          {
            foreignKeyName: 'keys_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          display_name: string | null
          household_id: string
          role: Database['public']['Enums']['member_role']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          display_name?: string | null
          household_id: string
          role?: Database['public']['Enums']['member_role']
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          household_id?: string
          role?: Database['public']['Enums']['member_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_household_id_fkey'
            columns: ['household_id']
            isOneToOne: false
            referencedRelation: 'households'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_code: string; p_display_name?: string }; Returns: string }
      can_access_photo: { Args: { object_name: string }; Returns: boolean }
      create_household: { Args: { p_display_name?: string; p_name: string }; Returns: string }
      create_invite: {
        Args: {
          p_email?: string
          p_household_id: string
          p_role?: Database['public']['Enums']['member_role']
        }
        Returns: string
      }
      has_role: {
        Args: { hh: string; roles: Database['public']['Enums']['member_role'][] }
        Returns: boolean
      }
      is_member: { Args: { hh: string }; Returns: boolean }
      leave_household: { Args: { p_household_id: string }; Returns: undefined }
      remove_member: { Args: { p_household_id: string; p_user_id: string }; Returns: undefined }
    }
    Enums: {
      door_type: 'main' | 'room' | 'washroom' | 'balcony' | 'store' | 'other'
      member_role: 'owner' | 'admin' | 'member'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      door_type: ['main', 'room', 'washroom', 'balcony', 'store', 'other'],
      member_role: ['owner', 'admin', 'member'],
    },
  },
} as const
