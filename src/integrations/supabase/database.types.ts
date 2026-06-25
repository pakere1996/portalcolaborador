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
      admin_favoritos: {
        Row: {
          admin_id: string
          created_at: string | null
          icone: string
          id: string
          label: string
          ordem: number | null
          rota: string
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          icone: string
          id?: string
          label: string
          ordem?: number | null
          rota: string
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          icone?: string
          id?: string
          label?: string
          ordem?: number | null
          rota?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_favoritos_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      atestados: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          criado_por: string | null
          data_atestado: string
          dias_afastamento: number | null
          id: string
          observacao: string | null
          observacao_admin: string | null
          observacao_colaborador: string | null
          respondido_em: string | null
          respondido_por: string | null
          status: string | null
          storage_path: string | null
          storage_type: string | null
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_atestado: string
          dias_afastamento?: number | null
          id?: string
          observacao?: string | null
          observacao_admin?: string | null
          observacao_colaborador?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          status?: string | null
          storage_path?: string | null
          storage_type?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_atestado?: string
          dias_afastamento?: number | null
          id?: string
          observacao?: string | null
          observacao_admin?: string | null
          observacao_colaborador?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          status?: string | null
          storage_path?: string | null
          storage_type?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atestados_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atestados_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
      }
      avisos: {
        Row: {
          ativo: boolean | null
          colaborador_id: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string
          data_inicio: string
          id: string
          mensagem: string
          para_todos: boolean | null
          titulo: string
          updated_at: string | null
          arquivo_path: string | null
          arquivo_tipo: string | null
        }
        Insert: {
          ativo?: boolean | null
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          mensagem: string
          para_todos?: boolean | null
          titulo: string
          updated_at?: string | null
          arquivo_path?: string | null
          arquivo_tipo?: string | null
        }
        Update: {
          ativo?: boolean | null
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          mensagem?: string
          para_todos?: boolean | null
          titulo?: string
          updated_at?: string | null
          arquivo_path?: string | null
          arquivo_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avisos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      bloqueio_regra_unidades: {
        Row: {
          created_at: string | null
          id: string
          regra_id: string
          unidade_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          regra_id: string
          unidade_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          regra_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueio_regra_unidades_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "bloqueio_regras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueio_regra_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
      }
      bloqueio_regras: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string
          dia: number | null
          dia_semana: number | null
          id: string
          mes: number | null
          ordinal: number | null
          tipo: string
          updated_at: string
          aplicacao: string | null
          ano_referencia: number | null
          meses: number[] | null
          dias: number[] | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao: string
          dia?: number | null
          dia_semana?: number | null
          id?: string
          mes?: number | null
          ordinal?: number | null
          tipo: string
          updated_at?: string
          aplicacao?: string | null
          ano_referencia?: number | null
          meses?: number[] | null
          dias?: number[] | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string
          dia?: number | null
          dia_semana?: number | null
          id?: string
          mes?: number | null
          ordinal?: number | null
          tipo?: string
          updated_at?: string
          aplicacao?: string | null
          ano_referencia?: number | null
          meses?: number[] | null
          dias?: number[] | null
        }
        Relationships: []
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
      contracheques: {
        Row: {
          colaborador_id: string
          created_at: string
          id: string
          mes_referencia: string
          quinzena: number | null
          tipo: string
          updated_at: string
          url_arquivo: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          id?: string
          mes_referencia: string
          quinzena?: number | null
          tipo?: string
          updated_at?: string
          url_arquivo: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          id?: string
          mes_referencia?: string
          quinzena?: number | null
          tipo?: string
          updated_at?: string
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracheques_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      datas_bloqueadas: {
        Row: {
          auto: boolean
          created_at: string
          data: string
          id: string
          liberada: boolean
          motivo: string
          unidade_id: string | null
        }
        Insert: {
          auto?: boolean
          created_at?: string
          data: string
          id?: string
          liberada?: boolean
          motivo: string
          unidade_id?: string | null
        }
        Update: {
          auto?: boolean
          created_at?: string
          data?: string
          id?: string
          liberada?: boolean
          motivo?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "datas_bloqueadas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
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
          aprovado_em: string | null
          colaborador_id: string | null
          created_at: string | null
          id: string
          mes: number | null
          nome_pdf: string | null
          status: string | null
          storage_path: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string | null
          pagina: number | null
          subtipo: string | null
          quinzena: number | null
        }
        Insert: {
          ano?: number | null
          aprovado_em?: string | null
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          mes?: number | null
          nome_pdf?: string | null
          status?: string | null
          storage_path?: string | null
          tipo: string
          unidade_id?: string | null
          updated_at?: string | null
          pagina?: number | null
          subtipo?: string | null
          quinzena?: number | null
        }
        Update: {
          ano?: number | null
          aprovado_em?: string | null
          colaborador_id?: string | null
          created_at?: string | null
          id?: string
          mes?: number | null
          nome_pdf?: string | null
          status?: string | null
          storage_path?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string | null
          pagina?: number | null
          subtipo?: string | null
          quinzena?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
      }
      documentos_importacao: {
        Row: {
          caminho_arquivo: string
          created_at: string | null
          data_importacao: string | null
          id: string
          importado_por: string
          nome_arquivo: string
          status: string
          tamanho_bytes: number
          updated_at: string | null
        }
        Insert: {
          caminho_arquivo: string
          created_at?: string | null
          data_importacao?: string | null
          id?: string
          importado_por: string
          nome_arquivo: string
          status?: string
          tamanho_bytes: number
          updated_at?: string | null
        }
        Update: {
          caminho_arquivo?: string
          created_at?: string | null
          data_importacao?: string | null
          id?: string
          importado_por?: string
          nome_arquivo?: string
          status?: string
          tamanho_bytes?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      documentos_sindicato: {
        Row: {
          ano: number
          created_at: string | null
          id: string
          nome_pdf: string | null
          sindicato_id: string
          storage_path: string
          tipo_documento: string
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          id?: string
          nome_pdf?: string | null
          sindicato_id: string
          storage_path: string
          tipo_documento: string
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          id?: string
          nome_pdf?: string | null
          sindicato_id?: string
          storage_path?: string
          tipo_documento?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_sindicato_sindicato_id_fkey"
            columns: ["sindicato_id"]
            isOneToOne: false
            referencedRelation: "sindicatos"
            referencedColumns: ["id"]
          }
        ]
      }
      folgas: {
        Row: {
          created_at: string | null
          criado_por: string | null
          data: string
          extra: boolean
          id: string
          mes: string
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          criado_por?: string | null
          data: string
          extra?: boolean
          id?: string
          mes: string
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string | null
          data?: string
          extra?: boolean
          id?: string
          mes?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folgas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
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
          }
        ]
      }
      mensagens: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          mensagem: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          mensagem: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          mensagem?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      mensagens_enviadas: {
        Row: {
          colaborador_id: string | null
          enviado_em: string | null
          enviado_por: string | null
          id: string
          mensagem_id: string | null
          status: string | null
        }
        Insert: {
          colaborador_id?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_id?: string | null
          status?: string | null
        }
        Update: {
          colaborador_id?: string | null
          enviado_em?: string | null
          enviado_por?: string | null
          id?: string
          mensagem_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_enviadas_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_enviadas_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          }
        ]
      }
      modelos_mensagem: {
        Row: {
          ativo: boolean | null
          assunto: string
          corpo: string
          created_at: string | null
          criado_por: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          assunto: string
          corpo: string
          created_at?: string | null
          criado_por?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          assunto?: string
          corpo?: string
          created_at?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      negociacoes: {
        Row: {
          ano: number
          created_at: string | null
          id: string
          mes: number | null
          nome_pdf: string | null
          sindicato_laboral_id: string
          sindicato_patronal_id: string
          storage_path: string
          tipo_documento: string | null
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          id?: string
          mes?: number | null
          nome_pdf?: string | null
          sindicato_laboral_id: string
          sindicato_patronal_id: string
          storage_path: string
          tipo_documento?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          id?: string
          mes?: number | null
          nome_pdf?: string | null
          sindicato_laboral_id?: string
          sindicato_patronal_id?: string
          storage_path?: string
          tipo_documento?: string | null
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negociacoes_sindicato_laboral_id_fkey"
            columns: ["sindicato_laboral_id"]
            isOneToOne: false
            referencedRelation: "sindicatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociacoes_sindicato_patronal_id_fkey"
            columns: ["sindicato_patronal_id"]
            isOneToOne: false
            referencedRelation: "sindicatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negociacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
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
          }
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
          }
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
          cpf_updated_at: string | null
          cpf_validated: boolean
          created_at: string
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          email_contato: string | null
          endereco: string | null
          folga_fixa_semana: number | null
          id: string
          matricula: string | null
          nome: string
          optante_adiantamento: boolean | null
          possui_folha_ponto: boolean | null
          regime_trabalho: string | null
          tem_adiantamento_individual: boolean | null
          tipo_vinculo: string | null
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
          cpf_updated_at?: string | null
          cpf_validated?: boolean
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email_contato?: string | null
          endereco?: string | null
          folga_fixa_semana?: number | null
          id: string
          matricula?: string | null
          nome: string
          optante_adiantamento?: boolean | null
          possui_folha_ponto?: boolean | null
          regime_trabalho?: string | null
          tem_adiantamento_individual?: boolean | null
          tipo_vinculo?: string | null
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
          cpf_updated_at?: string | null
          cpf_validated?: boolean
          created_at?: string
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          email_contato?: string | null
          endereco?: string | null
          folga_fixa_semana?: number | null
          id?: string
          matricula?: string | null
          nome?: string
          optante_adiantamento?: boolean | null
          possui_folha_ponto?: boolean | null
          regime_trabalho?: string | null
          tem_adiantamento_individual?: boolean | null
          tipo_vinculo?: string | null
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
          }
        ]
      }
      registros_disciplinares: {
        Row: {
          colaborador_id: string | null
          created_at: string | null
          criado_por: string | null
          data_ocorrencia: string
          dias_afastamento: number | null
          id: string
          observacao: string | null
          storage_path: string | null
          storage_type: string | null
          tipo: string
          unidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_ocorrencia: string
          dias_afastamento?: number | null
          id?: string
          observacao?: string | null
          storage_path?: string | null
          storage_type?: string | null
          tipo: string
          unidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_ocorrencia?: string
          dias_afastamento?: number | null
          id?: string
          observacao?: string | null
          storage_path?: string | null
          storage_type?: string | null
          tipo?: string
          unidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registros_disciplinares_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_disciplinares_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
      }
      sindicato_cargos: {
        Row: {
          cargo_id: string | null
          created_at: string | null
          id: string
          sindicato_id: string | null
        }
        Insert: {
          cargo_id?: string | null
          created_at?: string | null
          id?: string
          sindicato_id?: string | null
        }
        Update: {
          cargo_id?: string | null
          created_at?: string | null
          id?: string
          sindicato_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sindicato_cargos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicato_cargos_sindicato_id_fkey"
            columns: ["sindicato_id"]
            isOneToOne: false
            referencedRelation: "sindicatos"
            referencedColumns: ["id"]
          }
        ]
      }
      sindicato_unidades: {
        Row: {
          created_at: string | null
          id: string
          sindicato_id: string | null
          unidade_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          sindicato_id?: string | null
          unidade_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          sindicato_id?: string | null
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sindicato_unidades_sindicato_id_fkey"
            columns: ["sindicato_id"]
            isOneToOne: false
            referencedRelation: "sindicatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sindicato_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
      }
      sindicatos: {
        Row: {
          cnpj: string | null
          contato_whatsapp: string | null
          created_at: string | null
          grupo_id: string | null
          id: string
          nome: string
          par_id: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          contato_whatsapp?: string | null
          created_at?: string | null
          grupo_id?: string | null
          id?: string
          nome: string
          par_id?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          contato_whatsapp?: string | null
          created_at?: string | null
          grupo_id?: string | null
          id?: string
          nome?: string
          par_id?: string | null
          tipo?: string | null
          updated_at?: string | null
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
          status: string
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
          status?: string
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
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_especiais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      suggested_profiles: {
        Row: {
          created_at: string
          document_id: string
          extracted_data: Json
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          document_id: string
          extracted_data: Json
          id?: string
          status?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          extracted_data?: Json
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggested_profiles_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          }
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
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
          }
        ]
      }
      unidade_cargos: {
        Row: {
          cargo_id: string
          created_at: string | null
          id: string
          sindicato_laboral_id: string | null
          unidade_id: string
          updated_at: string | null
        }
        Insert: {
          cargo_id: string
          created_at?: string | null
          id?: string
          sindicato_laboral_id?: string | null
          unidade_id: string
          updated_at?: string | null
        }
        Update: {
          cargo_id?: string
          created_at?: string | null
          id?: string
          sindicato_laboral_id?: string | null
          unidade_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidade_cargos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidade_cargos_sindicato_laboral_id_fkey"
            columns: ["sindicato_laboral_id"]
            isOneToOne: false
            referencedRelation: "sindicatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidade_cargos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          }
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string | null
          created_at: string | null
          dia_adiantamento: number | null
          endereco: string | null
          id: string
          nome: string
          possui_relogio_ponto: boolean | null
          tem_adiantamento: boolean | null
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          dia_adiantamento?: number | null
          endereco?: string | null
          id?: string
          nome: string
          possui_relogio_ponto?: boolean | null
          tem_adiantamento?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string | null
          created_at?: string | null
          dia_adiantamento?: number | null
          endereco?: string | null
          id?: string
          nome?: string
          possui_relogio_ponto?: boolean | null
          tem_adiantamento?: boolean | null
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      v_trocas_disponiveis: {
        Row: {
          created_at: string | null
          data_destinatario: string | null
          id: string | null
          mensagem: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calc_data_regra:
        | {
            Args: {
              _ano: number
              _regra: unknown
            }
            Returns: string
          }
        | {
            Args: {
              _ano: number
              _mes: number
              _regra: unknown
            }
            Returns: string
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
      gerar_bloqueios_proximos_meses: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      has_any_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin:
        | {
            Args: Record<PropertyKey, never>
            Returns: boolean
          }
        | {
            Args: {
              user_id: string
            }
            Returns: boolean
          }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema:keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never