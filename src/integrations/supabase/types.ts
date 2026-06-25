import { Database } from "./database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Profile = Tables<"profiles">;
export type Unidade = Tables<"unidades">;
export type Cargo = Tables<"cargos">;
export type Folga = Tables<"folgas">;
export type TrocaFolga = Tables<"trocas_folga">;
export type Notificacao = Tables<"notificacoes">;
export type Documento = Tables<"documentos">;
export type Atestado = Tables<"atestados">;
export type RegistroDisciplinar = Tables<"registros_disciplinares">;
export type Sindicato = Tables<"sindicatos">;
export type Negociacao = Tables<"negociacoes">;
export type BloqueioRegra = Tables<"bloqueio_regras">;
export type DataBloqueada = Tables<"datas_bloqueadas">;
export type DiaConfig = Tables<"dia_config">;
export type PrioridadeAniversario = Tables<"prioridade_aniversario">;
export type UserRole = Tables<"user_roles">;

export type DbResult<T> = T extends PromiseLike<infer U> ? U : never;
export type DbResultOk<T> = T extends PromiseLike<{ data: infer U }> ? Exclude<U, null> : never;