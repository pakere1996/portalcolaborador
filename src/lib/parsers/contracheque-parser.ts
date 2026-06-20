import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { findBestProfileMatch } from "../documentos-matching";

const INVALID_HEADER_TERMS = [
  "SALARIO",
  "SALÁRIO",
  "EMPREGADO",
  "REFLEXO",
  "HORAS",
  "ADICIONAL",
  "NOTURNO",
  "INTER",
  "REFERENCIA",
  "REFERÊNCIA",
  "PROVENTOS",
  "DESCONTOS",
  "INSS",
  "FGTS",
  "BASE",
  "LIQUIDO",
  "LÍQUIDO",
  "TOTAL",
  "CONTRACHEQUE",
  "HOLERITE",
  "RECIBO",
  "PAGAMENTO",
  "EMPRESA",
  "LTDA",
];

const FINANCIAL_SECTION_MARKERS = [
  "PROVENTOS",
  "DESCONTOS",
  "INSS",
  "FGTS",
  "SALARIO",
  "SALÁRIO",
  "BASE DE CALCULO",
  "BASE DE CÁLCULO",
  "LIQUIDO",
  "LÍQUIDO",
  "TOTAL A RECEBER",
  "TOTAL",
];

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function collapseSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeForCompare(value: string): string {
  return collapseSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function rejectInvalidHeaderValue(value: string | null | undefined): string | null {
  const cleaned = collapseSpaces(value ?? "");
  if (!cleaned) return null;

  const normalized = normalizeForCompare(cleaned);
  if (INVALID_HEADER_TERMS.some((term) => normalized.includes(normalizeForCompare(term)))) {
    return null;
  }

  return cleaned;
}

function firstLineMatch(header: string, regex: RegExp): string | null {
  for (const line of header.split(/\r?\n/)) {
    const match = line.match(regex);
    if (match?.[1]) return collapseSpaces(match[1]);
  }

  return null;
}

export class ContrachequeParser implements DocumentParser {
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[] {
    return pages.map((page) => {
      const text = page.text;
      const headerBlock = this.extractHeaderBlock(text);

      const nome = this.extractNomeFromHeader(headerBlock);
      const matricula = this.extractMatriculaFromHeader(headerBlock);
      const cargo = this.extractCargoFromHeader(headerBlock);
      const cpf = this.extractCpfFromHeader(headerBlock);
      const cnpj = this.extractCnpjFromHeader(headerBlock);
      const competencia = this.extractCompetenciaFromHeader(headerBlock);

      const match = findBestProfileMatch(nome, cpf, profiles as any, matricula);

      return {
        pageNumber: page.pageNumber,
        text,
        nome,
        cpf,
        matricula,
        cnpj,
        mes: competencia?.mes ?? null,
        ano: competencia?.ano ?? null,
        unidadeId: null,
        cargo,
        regimeTrabalho: null,
        isNewCargo: false,
        suggestedCargoName: cargo,
        dataAdmissao: null,
        matchStatus: match.status as "automatico" | "sugerido" | "revisao",
        matchedProfile: match.profile as any,
        confidence: match.confidence,
        vinculado: false,
        ignorado: false,
      };
    });
  }

  private extractHeaderBlock(text: string): string {
    const upperText = text.toUpperCase();
    const markerIndexes = FINANCIAL_SECTION_MARKERS
      .map((marker) => upperText.indexOf(marker))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);

    const cutIndex = markerIndexes[0] ?? -1;
    if (cutIndex === -1) return collapseSpaces(text.slice(0, Math.min(700, text.length)));

    return collapseSpaces(text.slice(0, cutIndex));
  }

  private extractNomeFromHeader(header: string): string | null {
    const cpf = this.extractCpfFromHeader(header);

    if (cpf) {
      const beforeCpf = header.slice(0, header.indexOf(cpf));
      const labelMatch = beforeCpf.match(
        /(?:Nome|Empregado|Colaborador|Funcion[aá]rio)\s*[:\-]?\s*([^\r\n]{3,})/i,
      );

      let candidate = labelMatch?.[1] ?? null;

      if (!candidate) {
        const lines = beforeCpf.split(/\r?\n/).map(collapseSpaces).filter(Boolean);
        candidate = lines[lines.length - 1] ?? null;
      }

      candidate = candidate
        ?.split(/(?:CPF|Matr[ií]cula|C[oó]digo|Cargo|Unidade|CNPJ|Compet[eê]ncia|Refer[eê]ncia)/i)[0]
        ?? null;

      const name = rejectInvalidHeaderValue(candidate);
      if (name) return name;
    }

    const lineName = firstLineMatch(
      header,
      /^[A-Za-zÀ-ÖØ-öø-ÿÇç\s.\-]{3,}$/,
    );

    return rejectInvalidHeaderValue(lineName);
  }

  private extractMatriculaFromHeader(header: string): string | null {
    const patterns = [
      /(?:Matr[ií]cula|Matricula|C[oó]digo|Codigo)\s*[:\-]?\s*(\d{1,8})/i,
      /\b(\d{1,8})\b\s+[A-Za-zÀ-ÖØ-öø-ÿÇç]/i,
    ];

    for (const pattern of patterns) {
      const match = header.match(pattern);
      if (match?.[1]) return match[1];
    }

    return null;
  }

  private extractCpfFromHeader(header: string): string | null {
    const formatted = header.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if (formatted) return formatted[0];

    const digits = header.match(/\b\d{11}\b/);
    if (!digits) return null;

    const cpf = digits[0];
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }

  private extractCnpjFromHeader(header: string): string | null {
    return header.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0] ?? null;
  }

  private extractCargoFromHeader(header: string): string | null {
    const match = header.match(
      /(?:Cargo|Fun[çc][ãa]o|Cargo\/Fun[çc][ãa]o)\s*[:\-]?\s*([^\r\n]{2,})/i,
    );

    const candidate = match?.[1]
      ?.split(/(?:Proventos|Descontos|INSS|FGTS|Sal[aá]rio|Base|Refer[eê]ncia|Compet[eê]ncia|Periodo|Per[ií]odo)/i)[0]
      ?? null;

    return rejectInvalidHeaderValue(candidate);
  }

  private extractCompetenciaFromHeader(header: string): { mes: number; ano: number } | null {
    const text = normalizeForCompare(header);

    const monthNameMatch = text.match(
      /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b\s+(?:de\s+)?(\d{4})/i,
    );

    if (monthNameMatch?.[1] && monthNameMatch?.[2]) {
      return { mes: MONTHS[monthNameMatch[1]], ano: Number(monthNameMatch[2]) };
    }

    const patterns = [
      /competencia\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,
      /referencia\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,
      /periodo\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,
      /\b(\d{1,2})\s*\/\s*(\d{4})\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1] && match?.[2]) {
        return { mes: Number(match[1]), ano: Number(match[2]) };
      }
    }

    return null;
  }
}