import { Tables } from "@/integrations/supabase/types";
// ... existing code ...
import { PDFDocument } from "pdf-lib";

// --- Tipos e Interfaces ---
// ... existing code ...
// --- Funções de Armazenamento ---

export function getDocumentStoragePath(profileId: string, tipo: DocumentType, ano: number, mes: number): string {
// ... existing code ...
}

export function getPendingDocumentStoragePath(tipo: DocumentType, ano: number, mes: number, pageNumbers: number[], identifiedName: string): string {
// ... existing code ...
}

// --- Funções de Validação e Histórico ---

/**
// ... existing code ...
 * Constrói o histórico mensal de documentos.
 */
export function buildMonthlyHistory(docs: Documento[], tipo: DocumentType, months: number): MonthlyHistoryItem[] {
// ... existing code ...
  return history.reverse();
}

// --- Funções de Extração e Match (Mantidas) ---

export function findBestProfileMatch(
// ... existing code ...
  return bestMatch;
}

/**
// ... existing code ...
 * @returns Um objeto ExtractedData.
 */
export function extractStructuredData(text: string): ExtractedData {
// ... existing code ...
  return data;
}

/**
 * Retorna o rótulo amigável para o tipo de documento.
 */
export function getDocumentTypeLabel(type: DocumentType): string {
// ... existing code ...
  }
}

/**
 * Sincroniza o lembrete de documentos mensais para administradores.
 * Esta função deve ser chamada após qualquer alteração nos documentos.
 */
export async function syncAdminMonthlyDocumentReminder() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // 1. Verificar se já existe um documento para o mês atual (Contracheque e Folha de Ponto)
  const { data: docs, error } = await supabase
    .from("documentos")
    .select("tipo")
    .eq("mes", currentMonth)
    .eq("ano", currentYear);

  if (error) {
    console.error("Erro ao verificar documentos:", error);
    return;
  }

  const hasContracheque = docs.some((d) => d.tipo === "contracheque");
  const hasFolhaPonto = docs.some((d) => d.tipo === "folha_ponto");

  // 2. Identificar o status do lembrete
  let status: "ok" | "pendente" = "ok";
  let message = "Todos os documentos mensais foram enviados.";

  if (!hasContracheque && !hasFolhaPonto) {
    status = "pendente";
    message = "Faltam Contracheque e Folha de Ponto do mês atual.";
  } else if (!hasContracheque) {
    status = "pendente";
    message = "Falta o Contracheque do mês atual.";
  } else if (!hasFolhaPonto) {
    status = "pendente";
    message = "Falta a Folha de Ponto do mês atual.";
  }

  // 3. Atualizar ou criar o registro de lembrete (usando um ID fixo para ser um singleton)
  // Corrigido: Usando um UUID estático válido para evitar o erro 22P02.
  const reminderId = "00000000-0000-0000-0000-000000000001"; 

  const { error: upsertError } = await supabase.from("notificacoes").upsert(
    {
      id: reminderId,
      user_id: "admin_placeholder", // Usado para identificar notificações administrativas
      titulo: "Documentos Mensais",
      mensagem: message,
      tipo: "admin_reminder",
      lida: status === "ok", // Marca como lida se estiver OK
      link: "/admin/documentos",
      payload: { status, mes: currentMonth, ano: currentYear },
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    console.error("Erro ao atualizar lembrete administrativo:", upsertError);
  }
}