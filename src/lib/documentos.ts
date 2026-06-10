import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "./cpf";
import { toast } from "sonner";

// Tipos e Interfaces
// ... existing code ...
export type Profile = Tables<"profiles"> & { matricula: string };

// ... existing code ...
export function findBestProfileMatch(
  pageText: string,
  profiles: Profile[],
  unidadeId: string
): { profile: Profile; score: number } | null {
  const extractedData = extractStructuredData(pageText);
  let bestMatch: { profile: Profile; score: number } | null = null;

  // 1. Filtrar perfis pela unidade selecionada
  const filteredProfiles = profiles.filter(p => p.unidade_id === unidadeId);

  if (filteredProfiles.length === 0) {
    return null;
  }

  // 2. Tentar match por CPF (Prioridade 1)
  if (extractedData.cpf) {
    const cleanedCpf = onlyDigits(extractedData.cpf);
    const match = filteredProfiles.find((p) => onlyDigits(p.cpf) === cleanedCpf);
    if (match) {
      return { profile: match, score: 100 }; // Match perfeito
    }
  }

  // 3. Tentar match por Matrícula (Prioridade 2)
  if (extractedData.matricula) {
    const cleanedMatricula = extractedData.matricula.trim().toLowerCase();
    const match = filteredProfiles.find(
      (p) => p.matricula?.trim().toLowerCase() === cleanedMatricula
    );
    if (match) {
      return { profile: match, score: 90 }; // Match forte
    }
  }

  // 4. Tentar match por Nome (Prioridade 3)
  if (extractedData.nome) {
    const cleanedExtractedName = extractedData.nome.trim().toLowerCase();
    let maxScore = 0;
    let bestNameMatch: Profile | null = null;

    for (const profile of filteredProfiles) {
      const cleanedProfileName = profile.nome.trim().toLowerCase();
      let score = 0;

      // Simples verificação de inclusão de palavras
      const extractedWords = cleanedExtractedName.split(/\s+/);
      const profileWords = cleanedProfileName.split(/\s+/);

      const commonWords = extractedWords.filter((word) => profileWords.includes(word));
      score = (commonWords.length / Math.max(extractedWords.length, profileWords.length)) * 80;

      if (score > maxScore) {
        maxScore = score;
        bestNameMatch = profile;
      }
    }

    if (bestNameMatch && maxScore >= 50) {
      // Se o score for razoável (50% de similaridade de palavras)
      bestMatch = { profile: bestNameMatch, score: maxScore };
    }
  }

  return bestMatch;
}

/**
 * Extrai dados estruturados (Nome, CPF, Matrícula, Cargo, Unidade) do texto.
 * @param text O texto completo da página.
 * @returns Um objeto ExtractedData.
 */
export function extractStructuredData(text: string): ExtractedData {
  const data: ExtractedData = {};
  const lines = text.split("\n");

  // Regex para CPF (XXX.XXX.XXX-XX)
  const cpfMatch = text.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (cpfMatch) {
    data.cpf = cpfMatch[1];
  }

  // Regex para Matrícula (procura por "Matrícula:" ou "Matricula:" seguido por números/letras)
  const matriculaMatch = text.match(/(?:Matrícula|Matricula|Registro|Cód\.|Cod\.)\s*[:\s]\s*(\w+)/i);
  if (matriculaMatch) {
    data.matricula = matriculaMatch[1].trim();
  }

  // Tentativa de extrair Nome (muito dependente do formato, geralmente próximo ao topo)
  // Esta é uma heurística fraca e deve ser melhorada se necessário.
  const nameKeywords = ["Nome:", "Colaborador:", "Funcionário:"];
  for (const line of lines.slice(0, 10)) {
    for (const keyword of nameKeywords) {
      if (line.includes(keyword)) {
        const name = line.split(keyword)[1]?.trim();
        if (name && name.length > 5 && !name.match(/\d/)) {
          data.nome = name;
          break;
        }
      }
    }
    if (data.nome) break;
  }

  // Tentativa de extrair Cargo
  const cargoKeywords = ["Cargo:", "Função:"];
  for (const line of lines.slice(0, 15)) {
    for (const keyword of cargoKeywords) {
      if (line.includes(keyword)) {
        const cargo = line.split(keyword)[1]?.trim().split(/\s{2,}|\n/)[0];
        if (cargo && cargo.length > 3) {
          data.cargo = cargo;
          break;
        }
      }
    }
    if (data.cargo) break;
  }

  // Tentativa de extrair Unidade (muito fraco, geralmente no cabeçalho/rodapé)
  // Não implementaremos uma extração robusta de unidade aqui, pois a seleção manual é obrigatória.
  // Apenas para fins de debug ou sugestão fraca.
  const unidadeMatch = text.match(/(?:Unidade|Filial)\s*[:\s]\s*([A-Za-z\s]+)/i);
  if (unidadeMatch) {
    data.unidade = unidadeMatch[1].trim();
  }

  return data;
}

// ... existing code ...

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
  const reminderId = "monthly_document_reminder";

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