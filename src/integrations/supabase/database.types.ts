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
          regime_trabalho: string | null
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
          regime_trabalho?: string | null
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
          regime_trabalho?: string | null
          updated_at?: string | null
          created_at?: string | null
        }
      }
      // ... manter as outras tabelas conforme o arquivo original
      user_roles: { Row: { id: string; user_id: string; role: string; created_at: string | null }; Insert: { id?: string; user_id: string; role: string; created_at?: string | null }; Update: { id?: string; user_id?: string; role?: string; created_at?: string | null } }
      unidades: { Row: { id: string; nome: string; cnpj: string | null; endereco: string | null; cidade: string | null; telefone: string | null; ativo: boolean; created_at: string | null }; Insert: { id?: string; nome: string; cnpj?: string | null; endereco?: string | null; cidade?: string | null; telefone?: string | null; ativo?: boolean; created_at?: string | null }; Update: { id?: string; nome?: string; cnpj?: string | null; endereco?: string | null; cidade?: string | null; telefone?: string | null; ativo?: boolean; created_at?: string | null } }
      cargos: { Row: { id: string; nome: string; descricao: string | null; ativo: boolean; created_at: string | null }; Insert: { id?: string; nome: string; descricao?: string | null; ativo?: boolean; created_at?: string | null }; Update: { id?: string; nome?: string; descricao?: string | null; ativo?: boolean; created_at?: string | null } }
      folgas: { Row: { id: string; user_id: string; data: string; mes: string; tipo: string; criado_por: string | null; created_at: string | null }; Insert: { id?: string; user_id: string; data: string; mes: string; tipo: string; criado_por?: string | null; created_at?: string | null }; Update: { id?: string; user_id?: string; data?: string; mes?: string; tipo?: string; criado_por?: string | null; created_at?: string | null } }
      documentos: { Row: { id: string; colaborador_id: string; tipo: string; mes: number; ano: number; storage_path: string; status: string; nome_pdf: string | null; created_at: string | null; updated_at: string | null }; Insert: { id?: string; colaborador_id: string; tipo: string; mes: number; ano: number; storage_path: string; status?: string; nome_pdf?: string | null; created_at?: string | null; updated_at?: string | null }; Update: { id?: string; colaborador_id?: string; tipo?: string; mes?: number; ano?: number; storage_path?: string; status?: string; nome_pdf?: string | null; created_at?: string | null; updated_at?: string | null } }
      atestados: { Row: { id: string; user_id: string; colaborador_id: string; data_atestado: string; dias_afastamento: number; observacao: string | null; observacao_admin: string | null; status: string; storage_path: string; storage_type: string; criado_por: string | null; respondido_por: string | null; respondido_em: string | null; created_at: string | null; updated_at: string | null }; Insert: { id?: string; user_id: string; colaborador_id: string; data_atestado: string; dias_afastamento: number; observacao?: string | null; observacao_admin?: string | null; status?: string; storage_path: string; storage_type: string; criado_por?: string | null; respondido_por?: string | null; respondido_em?: string | null; created_at?: string | null; updated_at?: string | null }; Update: { id?: string; user_id?: string; colaborador_id?: string; data_atestado?: string; dias_afastamento?: number; observacao?: string | null; observacao_admin?: string | null; status?: string; storage_path?: string; storage_type?: string; criado_por?: string | null; respondido_por?: string | null; respondido_em?: string | null; created_at?: string | null; updated_at?: string | null } }
      registros_disciplinares: { Row: { id: string; user_id: string; colaborador_id: string; tipo: string; data: string; observacao: string | null; storage_path: string; storage_type: string; criado_por: string | null; created_at: string | null }; Insert: { id?: string; user_id: string; colaborador_id: string; tipo: string; data: string; observacao?: string | null; storage_path: string; storage_type: string; criado_por?: string | null; created_at?: string | null }; Update: { id?: string; user_id?: string; colaborador_id?: string; tipo?: string; data?: string; observacao?: string | null; storage_path?: string; storage_type?: string; criado_por?: string | null; created_at?: string | null } }
      notificacoes: { Row: { id: string; user_id: string; titulo: string; mensagem: string | null; tipo: string; lida: boolean; link: string | null; created_at: string | null }; Insert: { id?: string; user_id: string; titulo: string; mensagem?: string | null; tipo: string; lida?: boolean; link?: string | null; created_at?: string | null }; Update: { id?: string; user_id?: string; titulo?: string; mensagem?: string | null; tipo?: string; lida?: boolean; link?: string | null; created_at?: string | null } }
      trocas_folga: { Row: { id: string; solicitante_id: string; destinatario_id: string | null; data_solicitante: string | null; data_destinatario: string; status: string; mensagem: string | null; created_at: string | null; updated_at: string | null; respondido_em: string | null }; Insert: { id?: string; solicitante_id: string; destinatario_id?: string | null; data_solicitante?: string | null; data_destinatario: string; status?: string; mensagem?: string | null; created_at?: string | null; updated_at?: string | null; respondido_em?: string | null }; Update: { id?: string; solicitante_id?: string; destinatario_id?: string | null; data_solicitante?: string | null; data_destinatario?: string; status?: string; mensagem?: string | null; created_at?: string | null; updated_at?: string | null; respondido_em?: string | null } }
      solicitacoes_especiais: { Row: { id: string; user_id: string; data: string; motivo: string; status: string; resposta_admin: string | null; respondido_por: string | null; respondido_em: string | null; created_at: string | null }; Insert: { id?: string; user_id: string; data: string; motivo: string; status?: string; resposta_admin?: string | null; respondido_por?: string | null; respondido_em?: string | null; created_at?: string | null }; Update: { id?: string; user_id?: string; data?: string; motivo?: string; status?: string; resposta_admin?: string | null; respondido_por?: string | null; respondido_em?: string | null; created_at?: string | null } }
      dia_config: { Row: { data: string; limite_colaboradores: number; observacao: string | null; created_at: string; updated_at: string }; Insert: { data: string; limite_colaboradores?: number; observacao?: string | null; created_at?: string; updated_at?: string }; Update: { data?: string; limite_colaboradores?: number; observacao?: string | null; created_at?: string; updated_at?: string } }
      bloqueio_regras: { Row: { id: string; descricao: string; tipo: string; mes: number | null; dia: number | null; ordinal: number | null; dia_semana: number | null; ativo: boolean; created_at: string; updated_at: string }; Insert: { id?: string; descricao: string; tipo: string; mes?: number | null; dia?: number | null; ordinal?: number | null; dia_semana?: number | null; ativo?: boolean; created_at?: string; updated_at?: string }; Update: { id?: string; descricao?: string; tipo?: string; mes?: number | null; dia?: number | null; ordinal?: number | null; dia_semana?: number | null; ativo?: boolean; created_at?: string; updated_at?: string } }
      datas_bloqueadas: { Row: { id: string; data: string; motivo: string; auto: boolean; liberada: boolean; created_at: string }; Insert: { id?: string; data: string; motivo: string; auto?: boolean; liberada?: boolean; created_at?: string }; Update: { id?: string; data?: string; motivo?: string; auto?: boolean; liberada?: boolean; created_at?: string } }
      prioridade_aniversario: { Row: { id: string; user_id: string; data: string; status: string; created_at: string; updated_at: string }; Insert: { id?: string; user_id: string; data: string; status?: string; created_at?: string; updated_at?: string }; Update: { id?: string; user_id?: string; data?: string; status?: string; created_at?: string; updated_at?: string } }
      suggested_profiles: { Row: { id: string; document_id: string; extracted_data: Json; status: string; created_at: string }; Insert: { id?: string; document_id: string; extracted_data: Json; status?: string; created_at?: string }; Update: { id?: string; document_id?: string; extracted_data?: Json; status?: string; created_at?: string } }
      documentos_importacao: { Row: { id: string; nome_arquivo: string; tamanho_bytes: number; caminho_arquivo: string; importado_por: string; status: string; data_importacao: string | null; created_at: string | null; updated_at: string | null }; Insert: { id?: string; nome_arquivo: string; tamanho_bytes: number; caminho_arquivo: string; importado_por: string; status?: string; data_importacao: string | null; created_at?: string | null; updated_at?: string | null }; Update: { id?: string; nome_arquivo?: string; tamanho_bytes?: number; caminho_arquivo?: string; importado_por?: string; status?: string; data_importacao: string | null; created_at?: string | null; updated_at?: string | null } }
    }
    Views: { v_trocas_disponiveis: { Row: { id: string | null; data_destinatario: string | null; mensagem: string | null; status: string | null; created_at: string | null } } }
    Functions: { check_is_admin: { Args: { user_id: string }; Returns: boolean }; is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }; has_any_admin: { Args: Record<PropertyKey, never>; Returns: boolean }; gerar_bloqueios_ano: { Args: { _ano: number }; Returns: number } }
    Enums: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]