import { Database } from "./database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserRole = Database["public"]["Tables"]["user_roles"]["Row"];
export type Folga = Database["public"]["Tables"]["folgas"]["Row"];
export type TrocaFolga = Database["public"]["Tables"]["trocas_folga"]["Row"];
export type Notificacao = Database["public"]["Tables"]["notificacoes"]["Row"];
export type Cargo = Database["public"]["Tables"]["cargos"]["Row"];
export type Documento = Database["public"]["Tables"]["documentos"]["Row"];
export type SuggestedProfile = Database["public"]["Tables"]["suggested_profiles"]["Row"];

export interface Unidade extends Database["public"]["Tables"]["unidades"]["Row"] {
  cnpj: string | null; // Added CNPJ
}