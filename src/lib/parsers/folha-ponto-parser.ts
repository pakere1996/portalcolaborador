// src/lib/parsers/folha-ponto-parser.ts
import { PageResult, ProfileForMatching } from "@/components/DocumentImportForm";

/**
 * Parser para folhas de ponto - implementação mínima.
 */
export function parseFolhaPonto(
  pages: { pageNumber: number; text: string }[],
  profiles: ProfileForMatching[]
): PageResult[] {
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
    matricula: null,
  }));
}

export class FolhaPontoParser {
  static parse(pages: { pageNumber: number; text: string }[], profiles: ProfileForMatching[]): PageResult[] {
    return parseFolhaPonto(pages, profiles);
  }
}