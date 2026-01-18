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
      autonomous_clients: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomous_interventions: {
        Row: {
          address: string | null
          assigned_to: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          date_end: string | null
          date_planned: string | null
          date_start: string | null
          description: string | null
          id: string
          label: string
          latitude: number | null
          longitude: number | null
          priority: string | null
          reference: string
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date_end?: string | null
          date_planned?: string | null
          date_start?: string | null
          description?: string | null
          id?: string
          label: string
          latitude?: number | null
          longitude?: number | null
          priority?: string | null
          reference: string
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          date_end?: string | null
          date_planned?: string | null
          date_start?: string | null
          description?: string | null
          id?: string
          label?: string
          latitude?: number | null
          longitude?: number | null
          priority?: string | null
          reference?: string
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "autonomous_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autonomous_interventions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "autonomous_clients_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autonomous_interventions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      autonomous_products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          min_stock: number | null
          name: string
          price: number | null
          reference: string
          stock_quantity: number | null
          tenant_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          min_stock?: number | null
          name: string
          price?: number | null
          reference: string
          stock_quantity?: number | null
          tenant_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          min_stock?: number | null
          name?: string
          price?: number | null
          reference?: string
          stock_quantity?: number | null
          tenant_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      hours_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_date: string
          created_at: string
          excess_minutes: number
          id: string
          limit_minutes: number
          tenant_id: string
          total_minutes: number
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_date: string
          created_at?: string
          excess_minutes: number
          id?: string
          limit_minutes: number
          tenant_id: string
          total_minutes: number
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_date?: string
          created_at?: string
          excess_minutes?: number
          id?: string
          limit_minutes?: number
          tenant_id?: string
          total_minutes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hours_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_assignments: {
        Row: {
          acknowledged_at: string | null
          assigned_at: string
          assigned_by: string | null
          autonomous_intervention_id: string | null
          client_name: string | null
          created_at: string
          date_planned: string | null
          id: string
          intervention_id: number | null
          intervention_label: string
          intervention_ref: string
          is_primary: boolean | null
          last_reminder_sent: string | null
          location: string | null
          notification_acknowledged: boolean | null
          notification_sent: boolean | null
          priority: string
          reminder_count: number | null
          tenant_id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          acknowledged_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          autonomous_intervention_id?: string | null
          client_name?: string | null
          created_at?: string
          date_planned?: string | null
          id?: string
          intervention_id?: number | null
          intervention_label: string
          intervention_ref: string
          is_primary?: boolean | null
          last_reminder_sent?: string | null
          location?: string | null
          notification_acknowledged?: boolean | null
          notification_sent?: boolean | null
          priority?: string
          reminder_count?: number | null
          tenant_id: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          acknowledged_at?: string | null
          assigned_at?: string
          assigned_by?: string | null
          autonomous_intervention_id?: string | null
          client_name?: string | null
          created_at?: string
          date_planned?: string | null
          id?: string
          intervention_id?: number | null
          intervention_label?: string
          intervention_ref?: string
          is_primary?: boolean | null
          last_reminder_sent?: string | null
          location?: string | null
          notification_acknowledged?: boolean | null
          notification_sent?: boolean | null
          priority?: string
          reminder_count?: number | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_assignments_autonomous_intervention_id_fkey"
            columns: ["autonomous_intervention_id"]
            isOneToOne: false
            referencedRelation: "autonomous_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      released_interventions: {
        Row: {
          client_name: string
          created_at: string
          date_start: string | null
          id: string
          intervention_id: number
          intervention_label: string
          intervention_ref: string
          intervention_type: string
          latitude: number | null
          location: string
          longitude: number | null
          priority: string
          released_at: string
          released_by_name: string
          released_by_supabase_uid: string | null
          released_by_user_id: number
          status: string
          taken_at: string | null
          taken_by_name: string | null
          taken_by_supabase_uid: string | null
          taken_by_user_id: number | null
          tenant_id: string | null
        }
        Insert: {
          client_name: string
          created_at?: string
          date_start?: string | null
          id?: string
          intervention_id: number
          intervention_label: string
          intervention_ref: string
          intervention_type?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          priority?: string
          released_at?: string
          released_by_name: string
          released_by_supabase_uid?: string | null
          released_by_user_id: number
          status?: string
          taken_at?: string | null
          taken_by_name?: string | null
          taken_by_supabase_uid?: string | null
          taken_by_user_id?: number | null
          tenant_id?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string
          date_start?: string | null
          id?: string
          intervention_id?: number
          intervention_label?: string
          intervention_ref?: string
          intervention_type?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          priority?: string
          released_at?: string
          released_by_name?: string
          released_by_supabase_uid?: string | null
          released_by_user_id?: number
          status?: string
          taken_at?: string | null
          taken_by_name?: string | null
          taken_by_supabase_uid?: string | null
          taken_by_user_id?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "released_interventions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_super_admin: boolean | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_super_admin?: boolean | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_super_admin?: boolean | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          max_users: number | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_users?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          max_users?: number | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_configurations: {
        Row: {
          created_at: string
          daily_hours_limit: number | null
          dolibarr_api_key: string | null
          dolibarr_url: string | null
          id: string
          language: string | null
          tenant_id: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_hours_limit?: number | null
          dolibarr_api_key?: string | null
          dolibarr_url?: string | null
          id?: string
          language?: string | null
          tenant_id: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_hours_limit?: number | null
          dolibarr_api_key?: string | null
          dolibarr_url?: string | null
          id?: string
          language?: string | null
          tenant_id?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          app_mode: Database["public"]["Enums"]["app_mode"]
          created_at: string
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          app_mode?: Database["public"]["Enums"]["app_mode"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          app_mode?: Database["public"]["Enums"]["app_mode"]
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["user_permission"]
          tenant_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["user_permission"]
          tenant_id: string
          user_id: string
          user_name: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["user_permission"]
          tenant_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_weekly_limits: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
          weekly_hours_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
          weekly_hours_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          weekly_hours_limit?: number
        }
        Relationships: []
      }
      work_time_entries: {
        Row: {
          clock_in: string
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_out: string | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          comment: string | null
          created_at: string
          dolibarr_line_id: number | null
          dolibarr_sync_at: string | null
          duration_minutes: number | null
          id: string
          intervention_id: number | null
          intervention_ref: string | null
          is_overtime: boolean | null
          rejection_reason: string | null
          status: string
          synced_to_dolibarr: boolean | null
          tenant_id: string
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
          work_type: string | null
        }
        Insert: {
          clock_in?: string
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          comment?: string | null
          created_at?: string
          dolibarr_line_id?: number | null
          dolibarr_sync_at?: string | null
          duration_minutes?: number | null
          id?: string
          intervention_id?: number | null
          intervention_ref?: string | null
          is_overtime?: boolean | null
          rejection_reason?: string | null
          status?: string
          synced_to_dolibarr?: boolean | null
          tenant_id: string
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
          work_type?: string | null
        }
        Update: {
          clock_in?: string
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          comment?: string | null
          created_at?: string
          dolibarr_line_id?: number | null
          dolibarr_sync_at?: string | null
          duration_minutes?: number | null
          id?: string
          intervention_id?: number | null
          intervention_ref?: string | null
          is_overtime?: boolean | null
          rejection_reason?: string | null
          status?: string
          synced_to_dolibarr?: boolean | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_locations: {
        Row: {
          accuracy: number | null
          current_intervention_id: number | null
          current_intervention_ref: string | null
          id: string
          is_online: boolean | null
          latitude: number
          longitude: number
          tenant_id: string
          updated_at: string
          user_id: string
          user_name: string
        }
        Insert: {
          accuracy?: number | null
          current_intervention_id?: number | null
          current_intervention_ref?: string | null
          id?: string
          is_online?: boolean | null
          latitude: number
          longitude: number
          tenant_id?: string
          updated_at?: string
          user_id: string
          user_name: string
        }
        Update: {
          accuracy?: number | null
          current_intervention_id?: number | null
          current_intervention_ref?: string | null
          id?: string
          is_online?: boolean | null
          latitude?: number
          longitude?: number
          tenant_id?: string
          updated_at?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      autonomous_clients_limited: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          id: string | null
          name: string | null
          notes: string | null
          postal_code: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          postal_code?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          notes?: string | null
          postal_code?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autonomous_clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_work_summary: {
        Row: {
          approved_minutes: number | null
          entry_count: number | null
          first_clock_in: string | null
          last_clock_out: string | null
          pending_minutes: number | null
          tenant_id: string | null
          total_minutes: number | null
          user_id: string | null
          work_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_work_summary: {
        Row: {
          approved_minutes: number | null
          entry_count: number | null
          month_start: string | null
          overtime_minutes: number | null
          regular_minutes: number | null
          tenant_id: string | null
          total_minutes: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_profiles_limited: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          is_super_admin: boolean | null
          phone: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          is_super_admin?: boolean | null
          phone?: never
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: never
          full_name?: string | null
          id?: string | null
          is_super_admin?: boolean | null
          phone?: never
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_configurations_safe: {
        Row: {
          created_at: string | null
          daily_hours_limit: number | null
          dolibarr_api_key: string | null
          dolibarr_url: string | null
          id: string | null
          language: string | null
          tenant_id: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_hours_limit?: number | null
          dolibarr_api_key?: never
          dolibarr_url?: string | null
          id?: string | null
          language?: string | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_hours_limit?: number | null
          dolibarr_api_key?: never
          dolibarr_url?: string | null
          id?: string | null
          language?: string | null
          tenant_id?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_work_summary: {
        Row: {
          approved_minutes: number | null
          entry_count: number | null
          first_clock_in: string | null
          last_clock_out: string | null
          overtime_minutes: number | null
          pending_minutes: number | null
          tenant_id: string | null
          total_minutes: number | null
          user_id: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_time_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_daily_hours_limit: {
        Args: { _date?: string; _tenant_id: string; _user_id: string }
        Returns: {
          is_exceeded: boolean
          limit_minutes: number
          remaining_minutes: number
          total_minutes: number
        }[]
      }
      get_user_permissions: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: string[]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_user_weekly_limit: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: number
      }
      has_management_role: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_user_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["user_permission"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      mask_api_key: { Args: { api_key: string }; Returns: string }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_mode: "autonomous" | "dolibarr"
      app_role: "owner" | "admin" | "manager" | "technician"
      subscription_plan:
        | "free_trial"
        | "standard"
        | "pro_dolibarr"
        | "enterprise"
      subscription_status:
        | "trial"
        | "active"
        | "past_due"
        | "cancelled"
        | "expired"
      user_permission:
        | "hours.view_own"
        | "hours.add_own"
        | "hours.modify_own_limit"
        | "hours.validate"
        | "hours.view_all"
        | "hours.export"
        | "hours.alerts"
        | "settings.hours"
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
    Enums: {
      app_mode: ["autonomous", "dolibarr"],
      app_role: ["owner", "admin", "manager", "technician"],
      subscription_plan: [
        "free_trial",
        "standard",
        "pro_dolibarr",
        "enterprise",
      ],
      subscription_status: [
        "trial",
        "active",
        "past_due",
        "cancelled",
        "expired",
      ],
      user_permission: [
        "hours.view_own",
        "hours.add_own",
        "hours.modify_own_limit",
        "hours.validate",
        "hours.view_all",
        "hours.export",
        "hours.alerts",
        "settings.hours",
      ],
    },
  },
} as const
