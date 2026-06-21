// src/lib/parsers/contracheque-parser.ts
import { PageResult, ProfileForMatching } from "@/components/DocumentImportForm";

/**
 * Parser para contracheques - implementação mínima.
 * Se precisar de funcionalidade real, implemente a extração de dados.
 */
export function parseContracheque(
  pages: { pageNumber: number; text: string }[],
  profiles: ProfileForMatching[]
): PageResult[] {
  // Versão simplificada que retorna páginas não vinculadas
  return pages.map((p) => ({
    pageNumber: p.pageNumber,
    text: p.text,
    nome: null,
    cnpj: null,
    mes: null,
    ano: null,
    unidadeId: null,
    matchStatus: "revisao" as const,
    matchedProfile: null,
    resolvido: false,
    ignorado: false,
    aprovado: false,
    duplicadoId: null,
    acaoSeDuplicado: null,
  }));
}

export class ContrachequeParser {
  static parse(pages: { pageNumber: number; text: string }[], profiles: ProfileForMatching[]): PageResult[] {
    return parseContracheque(pages, profiles);
  }
}