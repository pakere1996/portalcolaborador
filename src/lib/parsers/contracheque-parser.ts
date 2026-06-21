// src/lib/parsers/contracheque-parser.ts
import { PageResult, ProfileForMatching } from "@/components/DocumentImportForm";

export function parseContracheque(
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
    cargo: null,
    regime_trabalho: null,
  }));
}

export class ContrachequeParser {
  static parse(pages: { pageNumber: number; text: string }[], profiles: ProfileForMatching[]): PageResult[] {
    return parseContracheque(pages, profiles);
  }
}