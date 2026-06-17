import { extractCPF, findBestProfileMatch } from "./documentos-matching";
import { extractPeriodo } from "./documentos";
import type { ProfileForMatching } from "./document-parsers";

export interface ExtractedDocumentData {
  nome: string | null;
  cpf: string | null;
  cnpj: string | null;
  mes: number | null;
  ano: number | null;
  suggestedCargoName: string | null;
  dataAdmissao: string | null;
  matchStatus: "automatico" | "sugerido" | "revisao";
  matchedProfile: ProfileForMatching | null;
  confidence: number;
}

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
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

export function splitTextLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCPFValue(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return value;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatCNPJValue(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length !== 14) return value;

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function cleanExtractedText(value: string): string {
  return value
    .replace(/^[\s:;|\-–—]+/u, "")
    .replace(/\b(?:cpf|c\.p\.f|inscri[cç][aã][oã]o?|n[ºu]mero? cpf|matr[ií]cula|cargo|fun[cç][aã]o|categoria|unidade|setor|departamento|per[ií]odo|compet[eê]ncia|refer[eê]ncia|data|admiss[ãa]o|sal[aá]rio|valor|banco|ag[eê]ncia)\b.*$/iu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractValueAfterKeywords(text: string, keywords: string[]): string | null {
  const lines = splitTextLines(text);
  const orderedKeywords = [...keywords].sort((a, b) => b.length - a.length);

  for (const keyword of orderedKeywords) {
    const normalizedKeyword = normalizeForSearch(keyword);

    for (const line of lines) {
      const index = normalizeForSearch(line).indexOf(normalizedKeyword);
      if (index < 0) continue;

      const afterKeyword = line.slice(index + keyword.length);
      const cleaned = cleanExtractedText(afterKeyword);

      if (cleaned.length >= 2) return cleaned;
    }
  }

  return null;
}

function extractCPFWithKeywords(text: string): string | null {
  const valueAfterKeyword = extractValueAfterKeywords(text, [
    "cpf",
    "c.p.f",
    "inscrição",
    "inscricao",
    "nº cpf",
    "numero cpf",
    "número cpf",
  ]);

  if (valueAfterKeyword) {
    const match = valueAfterKeyword.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{11}/);
    if (match) return formatCPFValue(match[0]);
  }

  return extractCPF(text);
}

function extractNameNearKeywords(text: string, keywords: string[]): string | null {
  const keywordName = extractValueAfterKeywords(text, keywords);
  if (keywordName) return keywordName;

  const genericMatch = text.match(
    /\b(?:nome|nome do colaborador|nome do funcion[aá]rio|funcion[aá]rio|colaborador|empregado|trabalhador)\b\s*[:\-–—]?\s*([A-Za-zÀ-ÿÇç'’.\-\s]{3,})/iu,
  );

  if (genericMatch?.[1]) {
    return cleanExtractedText(genericMatch[1]);
  }

  const beforeCPF = text.match(
    /([A-Za-zÀ-ÿÇç'’.\-\s]{5,})\s+(?:cpf|c\.p\.f|inscri[cç][aã][oã]o?)\s*[:\-–—]?\s*\d{3}/iu,
  );

  if (beforeCPF?.[1]) {
    return cleanExtractedText(beforeCPF[1]);
  }

  return null;
}

function extractCNPJ(text: string): string | null {
  const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (!cnpjMatch) return null;

  return formatCNPJValue(cnpjMatch[0]);
}

function extractPeriodoContracheque(text: string): { mes: number; ano: number } | null {
  const mesAnoMatch = text.match(
    /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/iu,
  );

  if (mesAnoMatch?.[1] && mesAnoMatch[2]) {
    return {
      mes: MONTHS[mesAnoMatch[1].toLowerCase()],
      ano: Number(mesAnoMatch[2]),
    };
  }

  return extractPeriodo(text, "contracheque");
}

function extractPeriodoPonto(text: string): { mes: number; ano: number } | null {
  const match = text.match(/Periodo de referencia:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (match) {
    return { mes: Number(match[1]), ano: Number(match[3]) };
  }

  return extractPeriodo(text, "folha_ponto");
}

function extractCargo(text: string): string | null {
  const keywordCargo = extractValueAfterKeywords(text, [
    "cargo",
    "função",
    "funcao",
    "categoria",
    "cargo/função",
    "cargo/funcao",
  ]);

  if (keywordCargo) return keywordCargo;

  const fallback = text.match(
    /(?:cargo|fun[çc][ãa]o|cargo\/fun[çc][ãa]o|categoria)[:\s-]*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i,
  );

  return fallback ? cleanExtractedText(fallback[1]) : null;
}

function extractFolhaPontoName(text: string): string | null {
  const rowMatch = text.match(
    /\d{2}\/\d{2}\/\d{4}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+?)\s+\d+\s+[A-Z]/i,
  );

  if (rowMatch?.[1]) {
    return cleanExtractedText(rowMatch[1]);
  }

  return extractNameNearKeywords(text, [
    "nome",
    "nome do colaborador",
    "nome do funcionário",
    "nome do funcionario",
    "funcionário",
    "funcionario",
    "colaborador",
    "empregado",
  ]);
}

function extractDataAdmissao(text: string, periodo: { mes: number; ano: number } | null): string | null {
  const directMatch = text.match(
    /(?:admiss[ãa]o|admissao|data admiss[ãa]o|data admissao|adm)[:\s]*[^0-9/]{0,20}(\d{2})\/(\d{2})\/(\d{4})/i,
  );

  if (directMatch) {
    return `${directMatch[3]}-${directMatch[2]}-${directMatch[1]}`;
  }

  const allDates = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
  if (allDates.length > 0 && periodo) {
    const anoPeriodo = periodo.ano;
    let candidate = allDates.find((date) => Number(date.split("/")[2]) < anoPeriodo);

    if (!candidate) {
      const sortedDates = [...allDates].sort((a, b) => {
        const [dA, mA, aA] = a.split("/").map(Number);
        const [dB, mB, aB] = b.split("/").map(Number);
        return new Date(aA, mA - 1, dA).getTime() - new Date(aB, mB - 1, dB).getTime();
      });

      candidate = sortedDates[0];
    }

    if (candidate) {
      const [dia, mes, ano] = candidate.split("/");
      return `${ano}-${mes}-${dia}`;
    }
  }

  return null;
}

function buildExtractedData(
  nome: string | null,
  cpf: string | null,
  cnpj: string | null,
  mes: number | null,
  ano: number | null,
  suggestedCargoName: string | null,
  dataAdmissao: string | null,
  profiles: ProfileForMatching[],
): ExtractedDocumentData {
  const match = findBestProfileMatch(nome, cpf, profiles);

  return {
    nome,
    cpf,
    cnpj,
    mes,
    ano,
    suggestedCargoName,
    dataAdmissao,
    matchStatus: match.status === "novo_colaborador" ? "revisao" : (match.status as "automatico" | "sugerido" | "revisao"),
    matchedProfile: match.profile,
    confidence: match.confidence,
  };
}

export function extractFolhaPonto(text: string, profiles: ProfileForMatching[]): ExtractedDocumentData {
  console.log("[parseFolhaPonto] Raw PDF text:", text);
  console.log("[parseFolhaPonto] Lines:", splitTextLines(text));

  const nome = extractFolhaPontoName(text);
  const cpf = extractCPFWithKeywords(text);
  const periodo = extractPeriodoPonto(text);
  const cnpj = extractCNPJ(text);
  const cargo = extractCargo(text);
  const dataAdmissao = extractDataAdmissao(text, periodo);

  return buildExtractedData(nome, cpf, cnpj, periodo?.mes ?? null, periodo?.ano ?? null, cargo, dataAdmissao, profiles);
}

export function extractContracheque(text: string, profiles: ProfileForMatching[]): ExtractedDocumentData {
  console.log("[parseContracheque] Raw PDF text:", text);
  console.log("[parseContracheque] Lines:", splitTextLines(text));

  const nome = extractNameNearKeywords(text, [
    "nome",
    "nome do colaborador",
    "nome do funcionário",
    "nome do funcionario",
    "funcionário",
    "funcionario",
    "colaborador",
    "empregado",
    "trabalhador",
  ]);
  const cpf = extractCPFWithKeywords(text);
  const periodo = extractPeriodoContracheque(text);
  const cnpj = extractCNPJ(text);
  const cargo = extractCargo(text);
  const dataAdmissao = extractDataAdmissao(text, periodo);

  return buildExtractedData(nome, cpf, cnpj, periodo?.mes ?? null, periodo?.ano ?? null, cargo, dataAdmissao, profiles);
}