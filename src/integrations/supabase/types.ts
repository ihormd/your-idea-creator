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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      inbound_aliases: {
        Row: {
          active: boolean
          alias: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          alias: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          alias?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      inbound_emails: {
        Row: {
          alias: string | null
          attachments_count: number
          created_at: string
          error: string | null
          from_email: string | null
          id: string
          receipts_created: number
          status: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          alias?: string | null
          attachments_count?: number
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          receipts_created?: number
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          alias?: string | null
          attachments_count?: number
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          receipts_created?: number
          status?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accounting_software: string
          budget_critical_pct: number
          budget_warn_pct: number
          business_name: string
          country: string
          created_at: string
          currency: string
          export_audience: string
          id: string
          logo_path: string | null
          mode: Database["public"]["Enums"]["app_mode"]
          onboarded: boolean
          theme: string
          updated_at: string
        }
        Insert: {
          accounting_software?: string
          budget_critical_pct?: number
          budget_warn_pct?: number
          business_name?: string
          country?: string
          created_at?: string
          currency?: string
          export_audience?: string
          id: string
          logo_path?: string | null
          mode?: Database["public"]["Enums"]["app_mode"]
          onboarded?: boolean
          theme?: string
          updated_at?: string
        }
        Update: {
          accounting_software?: string
          budget_critical_pct?: number
          budget_warn_pct?: number
          business_name?: string
          country?: string
          created_at?: string
          currency?: string
          export_audience?: string
          id?: string
          logo_path?: string | null
          mode?: Database["public"]["Enums"]["app_mode"]
          onboarded?: boolean
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          cost_budget: number
          created_at: string
          customer: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          project_number: string | null
          revenue: number
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_budget?: number
          created_at?: string
          customer?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          project_number?: string | null
          revenue?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_budget?: number
          created_at?: string
          customer?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          project_number?: string | null
          revenue?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_audit: {
        Row: {
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          receipt_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          receipt_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          receipt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_audit_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          ai_confidence: Json | null
          ai_raw: Json | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          duplicate_of: string | null
          gst_hst: number | null
          id: string
          image_path: string | null
          notes: string | null
          other_tax: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          project_id: string | null
          receipt_date: string | null
          receipt_number: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          source: string
          subtotal: number | null
          total: number
          updated_at: string
          user_id: string
          vendor: string | null
          warnings: string[]
        }
        Insert: {
          ai_confidence?: Json | null
          ai_raw?: Json | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          duplicate_of?: string | null
          gst_hst?: number | null
          id?: string
          image_path?: string | null
          notes?: string | null
          other_tax?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          receipt_date?: string | null
          receipt_number?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          source?: string
          subtotal?: number | null
          total?: number
          updated_at?: string
          user_id: string
          vendor?: string | null
          warnings?: string[]
        }
        Update: {
          ai_confidence?: Json | null
          ai_raw?: Json | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          duplicate_of?: string | null
          gst_hst?: number | null
          id?: string
          image_path?: string | null
          notes?: string | null
          other_tax?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          project_id?: string | null
          receipt_date?: string | null
          receipt_number?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          source?: string
          subtotal?: number | null
          total?: number
          updated_at?: string
          user_id?: string
          vendor?: string | null
          warnings?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "receipts_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_mode: "job" | "expense"
      expense_category:
        | "materials"
        | "fuel"
        | "tools"
        | "equipment"
        | "subcontractors"
        | "permits"
        | "travel"
        | "meals"
        | "other"
      payment_method:
        | "cash"
        | "credit_card"
        | "debit_card"
        | "etransfer"
        | "cheque"
        | "other"
      project_status: "active" | "completed" | "archived"
      review_status: "draft" | "needs_review" | "approved" | "exported"
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
      app_mode: ["job", "expense"],
      expense_category: [
        "materials",
        "fuel",
        "tools",
        "equipment",
        "subcontractors",
        "permits",
        "travel",
        "meals",
        "other",
      ],
      payment_method: [
        "cash",
        "credit_card",
        "debit_card",
        "etransfer",
        "cheque",
        "other",
      ],
      project_status: ["active", "completed", "archived"],
      review_status: ["draft", "needs_review", "approved", "exported"],
    },
  },
} as const
