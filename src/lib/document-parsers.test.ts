// src/lib/parsers/contracheque-parser.ts
import { PageResult } from "@/components/DocumentImportForm";

export const parseContracheque = (pages: { pageNumber: number; text: string }[], profiles: any[]): PageResult[] => {
  // Implementação mínima para evitar erros de build
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
};