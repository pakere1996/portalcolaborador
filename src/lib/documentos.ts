/**
 * Document utilities for the Folgas Pakerê application.
 * Provides helpers for document handling, CNPJ processing, and date extraction.
 */

export function getDocumentTypeLabel(tipo: string): string {
  switch (tipo) {
    case "contracheque":
      return "Contracheque";
    case "folha_ponto":
      return "Folha de Ponto";
    case "atestado":
      return "Atestado";
    case "disciplinar":
      return "Registro Disciplinar";
    default:
      return tipo;
  }
}

export function getDocumentStoragePath(
  colaboradorId: string,
  tipo: string,
  ano: number,
  mes: number
): string {
  return `documentos/${colaboradorId}/${tipo}/${ano}-${String(mes).padStart(2, "0")}`;
}

export function getPendingDocumentStoragePath(
  tipo: string,
  ano: number,
  mes: number,
  pageIndex: number
): string {
  return `documentos/pendentes/${tipo}/${ano}-${String(mes).padStart(2, "0")}-page${pageIndex}`;
}

export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export function formatCNPJ(cnpj: string): string {
  const clean = cleanCNPJ(cnpj);
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

export function validateCNPJFormat(cnpj: string): boolean {
  return /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(cnpj);
}

export function maskCNPJ(cnpj: string | null): string {
  if (!cnpj) return "—";
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) return cnpj;
  return formatCNPJ(clean);
}

export function extractCNPJFromText(text: string): string | null {
  const match = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  return match ? match[0] : null;
}

export function extractCNPJs(text: string): string[] {
  const regex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
  return text.match(regex) || [];
}

export function extractPeriodoFromText(text: string, docType: "contracheque" | "folha_ponto"): { mes: number; ano: number } | null {
  const meses: Record<string, number> = {
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

  // Normalize text for better matching
  const normalizedText = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "\n")
    .replace(/\f/g, " ")
    .replace(/\s+/g, " ");

  // Pattern 1: "Período de referência: de XX/XX/XXXX" (common in folha de ponto)
  const matchPonto1 = normalizedText.match(/Periodo de referencia:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (matchPonto1) {
    return { mes: parseInt(matchPonto1[1]), ano: parseInt(matchPonto1[3]) };
  }

  // Pattern 2: "Mês de XXXX" format (common in contracheques)
  const matchContracheque = normalizedText.match(/(\w+)\s+de\s+(\d{4})/i);
  if (matchContracheque) {
    const mes = meses[matchContracheque[1].toLowerCase()];
    if (mes) return { mes, ano: parseInt(matchContracheque[2]) };
  }

  // Pattern 3: "Competência: MM/YYYY" or similar
  const matchCompetencia = normalizedText.match(/Competencia:\s*(\d{2})\/(\d{4})/i);
  if (matchCompetencia) {
    return { mes: parseInt(matchCompetencia[1]), ano: parseInt(matchCompetencia[2]) };
  }

  // Pattern 4: "Referência: MM/YYYY" 
  const matchReferencia = normalizedText.match(/Referencia:\s*(\d{2})\/(\d{4})/i);
  if (matchReferencia) {
    return { mes: parseInt(matchReferencia[1]), ano: parseInt(matchReferencia[2]) };
  }

  // Pattern 5: "Periodo: MM/YYYY"
  const matchPeriodo = normalizedText.match(/Periodo:\s*(\d{2})\/(\d{4})/i);
  if (matchPeriodo) {
    return { mes: parseInt(matchPeriodo[1]), ano: parseInt(matchPeriodo[2]) };
  }

  // Pattern 6: "MM/YYYY" at the beginning or after keywords
  const matchDatePattern = normalizedText.match(/(?:Referencia|Competencia|Periodo|Mes)[^\d]*(\d{2})\/(\d{4})/i);
  if (matchDatePattern) {
    return { mes: parseInt(matchDatePattern[1]), ano: parseInt(matchDatePattern[2]) };
  }

  // Pattern 7: Try to find any MM/YYYY pattern as fallback
  const matchAnyDate = normalizedText.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/);
  if (matchAnyDate) {
    return { mes: parseInt(matchAnyDate[1]), ano: parseInt(matchAnyDate[2]) };
  }

  return null;
}

export async function syncAdminMonthlyDocumentReminder(): Promise<void> {
  console.log("Placeholder: syncAdminMonthlyDocumentReminder called.");
}