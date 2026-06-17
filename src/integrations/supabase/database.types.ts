export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nome: string
          cpf: string
          cargo: string
          ativo: boolean
          unidade_id: string | null
          matricula: string | null
          data_nascimento: string | null
          data_admissao: string | null
          folga_fixa_semana: number | null
          aprovacao_status: string | null
          email_contato: string | null
          whatsapp: string | null
          endereco: string | null
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          cpf: string
          cargo: string
          ativo?: boolean
          unidade_id?: string | null
          matricula?: string | null
          data_nascimento?: string | null
          data_admissao?: string | null
          folga_fixa_semana?: number | null
          aprovacao_status?: string | null
          email_contato?: string | null
          whatsapp?: string | null
          endereco?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          cpf?: string
          cargo?: string
          ativo?: boolean
          unidade_id?: string | null
          matricula?: string | null
          data_nascimento?: string | null
          data_admissao?: string | null
          folga_fixa_semana?: number | null
          aprovacao_status?: string | null
          email_contato?: string | null
          whatsapp?: string | null
          endereco?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          role: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          role?: string
          created_at?: string | null
        }
      }
      unidades: {
        Row: {
          id: string
          nome: string
          cnpj: string | null
          endereco: string | null
          cidade: string | null
          telefone: string | null
          ativo: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          cnpj?: string | null
          endereco?: string | null
          cidade?: string | null
          telefone?: string | null
          ativo?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          cnpj?: string | null
          endereco?: string | null
          cidade?: string | null
          telefone?: string | null
          ativo?: boolean
          created_at?: string | null
        }
      }
      cargos: {
        Row: {
          id: string
          nome: string
          ativo: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          ativo?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          ativo?: boolean
          created_at?: string | null
        }
      }
      folgas: {
        Row: {
          id: string
          colaborador_id: string
          data: string
          status: string
          tipo: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          colaborador_id: string
          data: string
          status?: string
          tipo?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          colaborador_id?: string
          data?: string
          status?: string
          tipo?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      documentos: {
        Row: {
          id: string
          colaborador_id: string
          tipo: string
          mes: number
          ano: number
          storage_path: string
          status: string
          nome_pdf: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          colaborador_id: string
          tipo: string
          mes: number
          ano: number
          storage_path: string
          status?: string
          nome_pdf?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          colaborador_id?: string
          tipo?: string
          mes?: number
          ano?: number
          storage_path?: string
          status?: string
          nome_pdf?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      atestados: {
        Row: {
          id: string
          user_id: string
          colaborador_id: string
          data_atestado: string
          dias_afastamento: number
          observacao: string | null
          observacao_admin: string | null
          status: string
          storage_path: string
          storage_type: string
          criado_por: string | null
          respondido_por: string | null
          respondido_em: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          colaborador_id: string
          data_atestado: string
          dias_afastamento: number
          observacao?: string | null
          observacao_admin?: string | null
          status?: string
          storage_path: string
          storage_type: string
          criado_por?: string | null
          respondido_por?: string | null
          respondido_em?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          colaborador_id?: string
          data_atestado?: string
          dias_afastamento?: number
          observacao?: string | null
          observacao_admin?: string | null
          status?: string
          storage_path?: string
          storage_type?: string
          criado_por?: string | null
          respondido_por?: string | null
          respondido_em?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      registros_disciplinares: {
        Row: {
          id: string
          user_id: string
          colaborador_id: string
          tipo: string
          data: string
          observacao: string | null
          storage_path: string
          storage_type: string
          criado_por: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          colaborador_id: string
          tipo: string
          data: string
          observacao?: string | null
          storage_path: string
          storage_type: string
          criado_por?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          colaborador_id?: string
          tipo?: string
          data?: string
          observacao?: string | null
          storage_path?: string
          storage_type?: string
          criado_por?: string | null
          created_at?: string | null
        }
      }
      notificacoes: {
        Row: {
          id: string
          user_id: string
          titulo: string
          mensagem: string
          tipo: string | null
          lida: boolean
          link: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          titulo: string
          mensagem: string
          tipo?: string | null
          lida?: boolean
          link?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          titulo?: string
          mensagem?: string
          tipo?: string | null
          lida?: boolean
          link?: string | null
          created_at?: string | null
        }
      }
      trocas_folga: {
        Row: {
          id: string
          solicitante_id: string
          receptor_id: string
          data_solicitante: string
          data_receptor: string
          status: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          solicitante_id: string
          receptor_id: string
          data_solicitante: string
          data_receptor: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          solicitante_id?: string
          receptor_id?: string
          data_solicitante?: string
          data_receptor?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      solicitacoes_especiais: {
        Row: {
          id: string
          colaborador_id: string
          data: string
          motivo: string | null
          status: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          colaborador_id: string
          data: string
          motivo?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          colaborador_id?: string
          data?: string
          motivo?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      dia_config: {
        Row: {
          id: string
          data: string
          limite_colaboradores: number
          created_at: string | null
        }
        Insert: {
          id?: string
          data: string
          limite_colaboradores: number
          created_at?: string | null
        }
        Update: {
          id?: string
          data?: string
          limite_colaboradores?: number
          created_at?: string | null
        }
      }
      bloqueio_regras: {
        Row: {
          id: string
          tipo: string
          descricao: string | null
          ativo: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          tipo: string
          descricao?: string | null
          ativo?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          tipo?: string
          descricao?: string | null
          ativo?: boolean
          created_at?: string | null
        }
      }
      datas_bloqueadas: {
        Row: {
          id: string
          data: string
          motivo: string | null
          liberada: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          data: string
          motivo?: string | null
          liberada?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          data?: string
          motivo?: string | null
          liberada?: boolean
          created_at?: string | null
        }
      }
      prioridade_aniversario: {
        Row: {
          id: string
          colaborador_id: string
          data: string
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          colaborador_id: string
          data: string
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          colaborador_id?: string
          data?: string
          status?: string
          created_at?: string | null
        }
      }
      suggested_profiles: {
        Row: {
          id: string
          nome: string
          cpf: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          cpf?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          cpf?: string | null
          created_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper type for table rows
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
