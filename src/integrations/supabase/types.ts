import { Database } from "./database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Tables<"profiles">;
export type UserRole = Tables<"user_roles">;
export type Folga = Tables<"folgas">;
export type TrocaFolga = Tables<"trocas_folga">;
export type Notificacao = Tables<"notificacoes">;
export type Cargo = Tables<"cargos">;
export type Documento = Tables<"documentos">;
export type Unidade = Tables<"unidades">;
export type SuggestedProfile = Tables<"suggested_profiles">;