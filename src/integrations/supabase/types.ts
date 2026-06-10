// ... existing code ...
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
          unidade_id: string | null
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
          unidade_id?: string | null
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
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
// ... existing code ...