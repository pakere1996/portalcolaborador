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
  cargo: string | null;           // ID do cargo oficial (se encontrado na base)
  isNewCargo: boolean;            // true se o cargo lido no PDF não existe na base
  suggestedCargoName: string | null; // Nome sugerido para cadastro na base
  dataAdmissao: string | null;    // YYYY-MM-DD
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