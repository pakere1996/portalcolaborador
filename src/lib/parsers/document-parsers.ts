import { PageText } from "../pdf-utils";

/**
 * Resultado padronizado que cada parser deve retornar por página.
 * Campos não aplicáveis ao tipo de documento devem vir como null.
 */
export interface PageResult {
  pageNumber: number;
  text: string;
  nome: string | null;
  cpf: string | null;
  cnpj: string | null;
  mes: number | null;
  ano: number | null;
  unidadeId: string | null;
  cargo: string | null;
  regimeTrabalho: "Horista" | "Mensalista" | null;
  isNewCargo: boolean;
  suggestedCargoName: string | null;
  dataAdmissao: string | null;
  matchStatus: "automatico" | "sugerido" | "revisao";
  matchedProfile: ProfileForMatching | null;
  confidence: number;
  vinculado: boolean;
  ignorado: boolean;
}

/**
 * Perfil mínimo necessário para matching (vem da tabela profiles).
 */
export interface ProfileForMatching {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
  cargo: string | null;
  unidade_id: string | null;
  regime_trabalho: string | null;
}

/**
 * Interface que todo parser de documento deve implementar.
 */
export interface DocumentParser {
  /**
   * Recebe o array de páginas já extraído pelo pdf-utils
   * e devolve um array de PageResult (um por página).
   */
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[];
}