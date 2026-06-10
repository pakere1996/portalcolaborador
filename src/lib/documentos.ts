import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "./cpf";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";

// --- Tipos e Interfaces ---
// ... existing code ...
// --- Funções de Extração e Match ---

/**
 * Encontra o melhor perfil correspondente para o texto da página.
// ... existing code ...
 * @returns O melhor match encontrado ou null.
 */
export function findBestProfileMatch(
// ... existing code ...
  return bestMatch;
}

/**
 * Extrai dados estruturados (Nome, CPF, Matrícula, Cargo, Unidade) do texto.
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
  switch (type) {
    case "contracheque":
      return "Contracheque";
    case "folha_ponto":
      return "Folha de Ponto";
    default:
      return "Documento";
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
  const { data: docs, error: docsError } = await supabase
    .from("documentos")
    .select("tipo")
    .eq("mes", currentMonth)
    .eq("ano", currentYear);

  if (docsError) {
    console.error("Erro ao verificar documentos:", docsError);
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

  // 3. Buscar todos os administradores reais
  const { data: admins, error: adminsError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (adminsError) {
    console.error("Erro ao buscar administradores:", adminsError);
    return;
  }

  const adminUserIds = admins.map(a => a.user_id);

  if (adminUserIds.length === 0) {
    console.log("Nenhum administrador encontrado para enviar lembrete.");
    return;
  }

  // 4. Criar/Atualizar notificação para cada administrador
  const notificationsToUpsert = adminUserIds.map(userId => ({
    // Usamos uma chave composta (tipo + mes + ano + user_id) para garantir a unicidade
    // e evitar a necessidade de um ID fixo para a notificação.
    // O ID será gerado automaticamente pelo banco de dados (se a coluna for default gen_random_uuid()).
    // Como a coluna 'id' é NOT NULL e não tem default, precisamos gerar um UUID aqui.
    id: crypto.randomUUID(), 
    user_id: userId,
    titulo: "Documentos Mensais",
    mensagem: message,
    tipo: "admin_reminder",
    lida: status === "ok",
    link: "/admin/documentos",
    payload: { status, mes: currentMonth, ano: currentYear },
  }));

  // Para garantir que não criamos duplicatas, vamos primeiro buscar notificações existentes
  // para este mês/ano e tipo, e atualizar apenas se o status mudou.
  
  // Simplificando a lógica: Se o status for 'ok', deletamos notificações pendentes.
  // Se for 'pendente', criamos/mantemos uma notificação.

  const notificationTitle = `Documentos Mensais - ${currentMonth}/${currentYear}`;

  if (status === 'ok') {
    // Se estiver OK, deletamos quaisquer lembretes pendentes para este período e tipo.
    const { error: deleteError } = await supabase
      .from("notificacoes")
      .delete()
      .eq("tipo", "admin_reminder")
      .eq("titulo", notificationTitle); // Usamos o título como chave de busca

    if (deleteError) {
      console.error("Erro ao deletar lembretes OK:", deleteError);
    }
    return;
  }

  // Se estiver PENDENTE, criamos uma notificação para cada administrador.
  // Para evitar duplicatas, vamos usar o user_id e o título como chave de unicidade.
  // Como a tabela não tem uma chave composta definida para upsert, vamos usar a estratégia de DELETE + INSERT.
  
  // 4a. Deletar notificações existentes para este período e tipo para evitar duplicatas
  const { error: deleteExistingError } = await supabase
    .from("notificacoes")
    .delete()
    .in("user_id", adminUserIds)
    .eq("tipo", "admin_reminder")
    .eq("titulo", notificationTitle);

  if (deleteExistingError) {
    console.error("Erro ao limpar notificações existentes:", deleteExistingError);
    return;
  }

  // 4b. Inserir novas notificações pendentes
  const notificationsToInsert = adminUserIds.map(userId => ({
    id: crypto.randomUUID(),
    user_id: userId,
    titulo: notificationTitle, // Usamos o título completo para unicidade
    mensagem: message,
    tipo: "admin_reminder",
    lida: false,
    link: "/admin/documentos",
    payload: { status, mes: currentMonth, ano: currentYear },
  }));

  const { error: insertError } = await supabase.from("notificacoes").insert(notificationsToInsert);

  if (insertError) {
    console.error("Erro ao inserir lembretes administrativos:", insertError);
  }
}