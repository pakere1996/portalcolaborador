import { Database } from "./database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

// Correção do Calendário: Garante que o Profile aceita 'unidade_id'
export type Profile = Tables<"profiles"> & {
  unidade_id?: string | null;
};

// Correção do Histórico Disciplinar e Disciplina.tsx:
// Mapeia os campos antigos esperados pela UI diretamente para o tipo exportado
export type Ocorrencia = Tables<"registros_disciplinares"> & {
  data_ocorrencia?: string | null;
  pdf_storage_path?: string | null;
  motivo?: string | null;
  descricao_detalhada?: string | null;
};

export type UserRole = Tables<"user_roles">;
export type Folga = Tables<"folgas">;
export type TrocaFolga = Tables<"trocas_folga">;
export type Notificacao = Tables<"notificacoes">;
export type Cargo = Tables<"cargos">;
export type Documento = Tables<"documentos">;
export type Unidade = Tables<"unidades">;
export type SuggestedProfile = Tables<"suggested_profiles">;