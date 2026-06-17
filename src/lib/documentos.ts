export function extractPeriodo(text: string, docType: string): { mes: number; ano: number } | null {
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

  const normalizedText = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "\n")
    .replace(/\f/g, " ")
    .replace(/\s+/g, " ");

  // Try specific patterns first
  const matchPonto1 = normalizedText.match(/Periodo de referencia:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (matchPonto1) {
    return { mes: parseInt(matchPonto1[1]), ano: parseInt(matchPonto1[3]) };
  }

  const matchContracheque = normalizedText.match(/(\w+)\s+de\s+(\d{4})/i);
  if (matchContracheque) {
    const mes = meses[matchContracheque[1].toLowerCase()];
    if (mes) return { mes, ano: parseInt(matchContracheque[2]) };
  }

  const matchCompetencia = normalizedText.match(/Competencia:\s*(\d{2})\/(\d{4})/i);
  if (matchCompetencia) {
    return { mes: parseInt(matchCompetencia[1]), ano: parseInt(matchCompetencia[2]) };
  }

  const matchReferencia = normalizedText.match(/Referencia:\s*(\d{2})\/(\d{4})/i);
  if (matchReferencia) {
    return { mes: parseInt(matchReferencia[1]), ano: parseInt(matchReferencia[2]) };
  }

  const matchPeriodo = normalizedText.match(/Periodo:\s*(\d{2})\/(\d{4})/i);
  if (matchPeriodo) {
    return { mes: parseInt(matchPeriodo[1]), ano: parseInt(matchPeriodo[2]) };
  }

  const matchAnyDate = normalizedText.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/);
  if (matchAnyDate) {
    return { mes: parseInt(matchAnyDate[1]), ano: parseInt(matchAnyDate[2]) };
  }

  return null;
}

export async function syncAdminMonthlyDocumentReminder() {
  // This function is called from the NotificationBell component
  // It can be used to trigger monthly document reminders for admins
  // For now, it's a no-op that can be extended with actual logic
  console.log("[syncAdminMonthlyDocumentReminder] Called - placeholder implementation");
  return { success: true };
}