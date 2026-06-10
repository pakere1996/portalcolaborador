/**
 * Document utilities for the Folgas Pakerê application.
 * Provides helpers for document handling, CNPJ processing, and date extraction.
 */

export function getDocumentTypeLabel(tipo: string): string {
  switch (tipo) {
    case "contracheque":
      return "Contracheque";
    case "ponto":
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

export function extractMonthAndYear(text: string, docType: "contracheque" | "folha_ponto"): { mes: number; ano: number } | null {
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

  // Try to match "Período de referência: de XX/XX/XXXX" format
  const matchPonto = text.match(/Per[íi]odo de refer[êe]ncia:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (matchPonto) {
    return { mes: parseInt(matchPonto[2]), ano: parseInt(matchPonto[3]) };
  }

  // Try to match "Mês de XXXX" format (common in contracheques)
  const matchContracheque = text.match(/(\w+)\s+de\s+(\d{4})/i);
  if (matchContracheque) {
    const mes = meses[matchContracheque[1].toLowerCase()];
    if (mes) return { mes, ano: parseInt(matchContracheque[2]) };
  }

  return null;
}

export async function syncAdminMonthlyDocumentReminder(): Promise<void> {
  console.log("Placeholder: syncAdminMonthlyDocumentReminder called.");
}