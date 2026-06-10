export function getDocumentTypeLabel(tipo: string): string {
  switch (tipo) {
    case "contracheque": return "Contracheque";
    case "ponto": return "Folha de Ponto";
    case "atestado": return "Atestado";
    case "disciplinar": return "Registro Disciplinar";
    default: return tipo;
  }
}

export interface Documento {
  id: string;
  colaborador_id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string | null;
  status: string;
  nome_pdf: string | null;
  created_at: string;
}

export function getDocumentStoragePath(colaboradorId: string, tipo: string, ano: number, mes: number): string {
  return `documentos/${colaboradorId}/${tipo}/${ano}-${String(mes).padStart(2, '0')}`;
}

export function getPendingDocumentStoragePath(tipo: string, ano: number, mes: number, pageIndex: number): string {
  return `documentos/pendentes/${tipo}/${ano}-${String(mes).padStart(2, '0')}-page${pageIndex}`;
}

export async function syncAdminMonthlyDocumentReminder(): Promise<void> {
  console.log('Placeholder: syncAdminMonthlyDocumentReminder called.');
}