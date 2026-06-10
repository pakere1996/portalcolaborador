export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          mes: number | null
          tipo: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          dia?: number | null
          dia_semana?: number | null
          id?: string
          mes?: number | null
          tipo: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          dia?: number | null
          dia_semana?: number | null
          id?: string
          mes?: number | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueio_regras_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
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
      documentos: {
        Row: {
          ano: number | null
          colaborador_id: string | null
          created_at: string | null
          id: string
          mes: number | null
          nome_pdf: string | null
          status: string | null
          storage_path: string | null
          tipo: string
        }
        Insert: {
          ano?: number | null
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          mes?: number | null
          nome_pdf?: string | null
          status?: string | null
          storage_path?: string | null
          tipo: string
        }
        Update: {
          ano?: number | null
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          mes?: number | null
          nome_pdf?: string | null
          status?: string | null
          storage_path?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "folgas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folgas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folgas_canceladas: {
        Row: {
          created_at: string | null
          data: string
          id: string
          motivo: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folgas_canceladas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "notificacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "prioridade_aniversario_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          ativo: boolean
          cargo: string
          cpf: string
          cpf_validated: boolean
          cpf_updated_at: string | null
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          email_contato: string | null
          endereco: string | null
          folga_fixa_semana: number | null
          id: string
          nome: string
          unidade_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          cargo: string
          cpf: string
          cpf_validated?: boolean
          cpf_updated_at?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email_contato?: string | null
          endereco?: string | null
          folga_fixa_semana?: number | null
          id: string
          nome: string
          unidade_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          cargo?: string
          cpf?: string
          cpf_validated?: boolean
          cpf_updated_at?: string | null
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email_contato?: string | null
          endereco?: string | null
          folga_fixa_semana?: number | null
          id?: string
          nome?: string
          unidade_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "solicitacoes_especiais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suggested_profiles: {
        Row: {
          created_at: string
          document_id: string
          extracted_data: Json
          id: string
          status: Database["public"]["Enums"]["suggestion_status"]
        }
        Insert: {
          created_at?: string
          document_id: string
          extracted_data: Json
          id?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Update: {
          created_at?: string
          document_id?: string
          extracted_data?: Json
          id?: string
          status?: Database["public"]["Enums"]["suggestion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "suggested_profiles_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      trocas_folga: {
        Row: {
          created_at: string | null
          data_destinatario: string
          data_solicitante: string | null
          destinatario_id: string | null
          id: string
          mensagem: string | null
          respondido_em: string | null
          solicitante_id: string | null
          status: Database["public"]["Enums"]["troca_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_destinatario: string
          data_solicitante?: string | null
          destinatario_id?: string | null
          id?: string
          mensagem?: string | null
          respondido_em?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["troca_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_destinatario?: string
          data_solicitante?: string | null
          destinatario_id?: string | null
          id?: string
          mensagem?: string | null
          respondido_em?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["troca_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trocas_folga_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trocas_folga_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
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
      v_trocas_disponiveis: {
        Row: {
          created_at: string | null
          data_destinatario: string | null
          id: string | null
          mensagem: string | null
          status: Database["public"]["Enums"]["troca_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      calc_data_regra: {
        Args: {
          _ano: number
          _mes: number
          _regra: Database["public"]["Tables"]["bloqueio_regras"]["Row"]
        }
        Returns: string
      }
      check_folga_availability: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      check_is_admin: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      gerar_bloqueios_ano: {
        Args: {
          _ano: number
        }
        Returns: number
      }
      has_any_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      rls_auto_enable: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      update_updated_at_column: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      app_role: "admin" | "user"
      solicitacao_status: "pendente" | "aprovada" | "rejeitada"
      suggestion_status: "pending" | "matched" | "ignored" | "created"
      troca_status: "pendente" | "aceita" | "rejeitada" | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[Extract<
      keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"]),
      string
    >]
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions]
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][Extract<
      keyof Database[PublicTableNameOrOptions["schema"]]["Tables"],
      string
    >]["Insert"]
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions]["Insert"]
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][Extract<
      keyof Database[PublicTableNameOrOptions["schema"]]["Tables"],
      string
    >]["Update"]
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions]["Update"]
    : never

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][Extract<
      keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"],
      string
    >]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never