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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bloqueio_regras: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          dia: number | null
          dia_semana: number | null
          id: string
          mes: number
          ordinal: number | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          dia?: number | null
          dia_semana?: number | null
          id?: string
          mes: number
          ordinal?: number | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          dia?: number | null
          dia_semana?: number | null
          id?: string
          mes?: number
          ordinal?: number | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      datas_bloqueadas: {
        Row: {
          auto: boolean
          created_at: string
          data: string
          id: string
          liberada: boolean
          motivo: string
        }
        Insert: {
          auto?: boolean
          created_at?: string
          data: string
          id?: string
          liberada?: boolean
          motivo: string
        }
        Update: {
          auto?: boolean
          created_at?: string
          data?: string
          id?: string
          liberada?: boolean
          motivo?: string
        }
        Relationships: []
      }
      dia_config: {
        Row: {
          created_at: string
          data: string
          limite_colaboradores: number
          observacao: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          limite_colaboradores?: number
          observacao?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          limite_colaboradores?: number
          observacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      folgas: {
        Row: {
          created_at: string
          criado_por: string | null
          data: string
          id: string
          mes: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data: string
          id?: string
          mes: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data?: string
          id?: string
          mes?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          payload: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          payload?: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          payload?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      prioridade_aniversario: {
        Row: {
          created_at: string
          data: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          ativo: boolean
          cargo: string
          cpf: string
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          folga_fixa_semana: number | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          cargo?: string
          cpf: string
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          folga_fixa_semana?: number | null
          id: string
          nome: string
          updated_at?: string
        }
        Update: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          cargo?: string
          cpf?: string
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          folga_fixa_semana?: number | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_especiais: {
        Row: {
          created_at: string
          data: string
          id: string
          motivo: string
          respondido_em: string | null
          respondido_por: string | null
          resposta_admin: string | null
          status: Database["public"]["Enums"]["solicitacao_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          motivo: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_admin?: string | null
          status?: Database["public"]["Enums"]["solicitacao_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          motivo?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta_admin?: string | null
          status?: Database["public"]["Enums"]["solicitacao_status"]
          user_id?: string
        }
        Relationships: []
      }
      trocas_folga: {
        Row: {
          created_at: string
          destinatario_aprovou: boolean
          destinatario_id: string
          dia_original: number
          dia_solicitado: number
          id: string
          mensagem: string | null
          respondido_em: string | null
          solicitante_aprovou: boolean
          solicitante_id: string
          status: Database["public"]["Enums"]["troca_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          destinatario_aprovou?: boolean
          destinatario_id: string
          dia_original: number
          dia_solicitado: number
          id?: string
          mensagem?: string | null
          respondido_em?: string | null
          solicitante_aprovou?: boolean
          solicitante_id: string
          status?: Database["public"]["Enums"]["troca_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          destinatario_aprovou?: boolean
          destinatario_id?: string
          dia_original?: number
          dia_solicitado?: number
          id?: string
          mensagem?: string | null
          respondido_em?: string | null
          solicitante_aprovou?: boolean
          solicitante_id?: string
          status?: Database["public"]["Enums"]["troca_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calc_data_regra: {
        Args: {
          _ano: number
          _regra: Database["public"]["Tables"]["bloqueio_regras"]["Row"]
        }
        Returns: string
      }
      folgas_dates_in_range: {
        Args: { _end: string; _start: string }
        Returns: {
          data: string
        }[]
      }
      gerar_bloqueios_ano: { Args: { _ano: number }; Returns: number }
      gerar_prioridades_aniversario: {
        Args: { _ano: number; _mes: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_first_admin: { Args: { _user_id: string }; Returns: undefined }
      sortear_folgas_mes: {
        Args: { _ano: number; _mes: number }
        Returns: {
          data: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "funcionario"
      solicitacao_status: "pendente" | "aprovada" | "recusada"
      troca_status: "pendente" | "aprovada" | "recusada" | "cancelada"
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
      app_role: ["admin", "funcionario"],
      solicitacao_status: ["pendente", "aprovada", "recusada"],
      troca_status: ["pendente", "aprovada", "recusada", "cancelada"],
    },
  },
} as const
