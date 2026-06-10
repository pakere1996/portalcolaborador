import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "./cpf";
// ... existing code ...
// ... existing code ...
export async function syncAdminMonthlyDocumentReminder() {
  const today = new Date();
// ... existing code ...
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
  const reminderId = "00000000-0000-0000-0000-000000000001"; 
  const adminUserId = "00000000-0000-0000-0000-000000000002"; // UUID estático para o usuário administrativo placeholder

  const { error: upsertError } = await supabase.from("notificacoes").upsert(
    {
      id: reminderId,
      user_id: adminUserId, // Usando UUID válido
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