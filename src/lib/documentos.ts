import { supabase } from "@/integrations/supabase/client";

export interface Documento {
  id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string;
  status: string;
  nome_pdf: string;
  colaborador_id: string;
  unidade_id: string | null;
  created_at: string;
}

export function getDocumentTypeLabel(tipo: string): string {
  switch (tipo) {
    case "contracheque":
      return "Contracheque";
    case "folha_ponto":
      return "Folha de Ponto";
    case "atestado":
      return "Atestado";
    case "registro_disciplinar":
      return "Registro Disciplinar";
    default:
      return tipo;
  }
}

export function getDocumentStoragePath(
  colaboradorId: string,
  tipo: string,
  mes: number,
  ano: number,
  fileName: string
): string {
  return `documentos/${tipo}/${colaboradorId}/${ano}-${String(mes).padStart(2, "0")}/${fileName}`;
}

export function getPendingDocumentStoragePath(
  colaboradorId: string,
  tipo: string,
  mes: number,
  ano: number,
  fileName: string
): string {
  return `documentos/pending/${tipo}/${colaboradorId}/${ano}-${String(mes).padStart(2, "0")}/${fileName}`;
}

export async function syncAdminMonthlyDocumentReminder() {
  console.log('Placeholder: syncAdminMonthlyDocumentReminder called.');
}