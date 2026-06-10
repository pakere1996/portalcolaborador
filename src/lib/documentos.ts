import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { onlyDigits } from "./cpf";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";

// --- Tipos e Interfaces ---

export type DocumentType = "contracheque" | "folha_ponto";

export type Documento = Tables<"documentos"> & { unidade_id: string | null };

export type Profile = Tables<"profiles"> & { matricula: string | null; unidade_id: string | null };

export interface ExtractedData {
  nome?: string;
  cpf?: string;
  matricula?: string;
  cargo?: string;
  unidade?: string;
}

export interface PageResult {
  pageNumber: number;
  text: string;
  status: "auto" | "manual" | "suggested" | "linked";
  profileId?: string;
  profileName?: string;
  score?: number;
  identifiedName: string;
  extractedData: ExtractedData;
}

export interface UploadStats {
  auto: number;
  manual: number;
  pending: number;
  total: number;
}

export interface MonthlyHistoryItem {
  mes: number;
  ano: number;
  status: "ok" | "faltando" | "duplicado";
  total: number;
}

// --- Funções de Processamento de PDF ---

/**
 * Extrai o texto de cada página de um arquivo PDF.
 */
export async function extractPdfText(file: File): Promise<{ pageNumber: number; text: string }[]> {
  // Implementação mockada para simular a extração de texto
  // Em um ambiente real, isso usaria uma biblioteca como pdf-parse ou uma Edge Function.
  await new Promise(resolve => setTimeout(resolve, 500));

  const mockText = `
    Página 1
    Nome: João da Silva
    CPF: 123.456.789-00
    Matrícula: 98765
    Cargo: Operador
    Unidade: Matriz

    Página 2
    Nome: Maria Oliveira
    CPF: 000.111.222-33
    Matrícula: 12345
    Cargo: Gerente
    Unidade: Filial A
  `;

  const pages = mockText.split("Página").filter(p => p.trim()).map((text, index) => ({
    pageNumber: index + 1,
    text: text.trim(),
  }));

  return pages;
}

/**
 * Cria um novo PDF contendo apenas as páginas especificadas.
 */
export async function createMergedPdf(file: File, pageNumbers: number[]): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const originalPdf = await PDFDocument.load(arrayBuffer);
  const mergedPdf = await PDFDocument.create();

  for (const pageNum of pageNumbers) {
    const [copiedPage] = await mergedPdf.copyPages(originalPdf, [pageNum - 1]);
    mergedPdf.addPage(copiedPage);
  }

  return mergedPdf.save();
}

/**
 * Tenta adivinhar o nome do colaborador a partir do texto da página.
 */
export function guessNameFromText(text: string, tipo: DocumentType): string {
  // Implementação heurística simples
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  
  // Tenta encontrar a primeira linha que parece um nome (sem números, sem pontuação excessiva)
  for (const line of lines.slice(0, 5)) {
    if (!line.match(/(\d|\.|\/|:|;)/) && line.length < 50) {
      return line.split(/\s{2,}/)[0] || "Nome Desconhecido";
    }
  }
  return "Nome Desconhecido";
}

/**
 * Detecta o período de referência (mês/ano) no texto do PDF.
 */
export function detectReferencePeriod(text: string, tipo: DocumentType): { mes: number; ano: number; sourceText: string } | null {
  const regex = /(\d{1,2})\/(\d{4})/; // Ex: 05/2024
  const match = text.match(regex);

  if (match) {
    const mes = parseInt(match[1], 10);
    const ano = parseInt(match[2], 10);
    if (mes >= 1 && mes <= 12 && ano >= 2020 && ano <= 2050) {
      return { mes, ano, sourceText: match[0] };
    }
  }
  return null;
}

// --- Funções de Armazenamento ---

export function getDocumentStoragePath(profileId: string, tipo: DocumentType, ano: number, mes: number): string {
  return `documentos/vinculados/${profileId}/${tipo}/${ano}/${mes}.pdf`;
}

export function getPendingDocumentStoragePath(tipo: DocumentType, ano: number, mes: number, pageNumbers: number[], identifiedName: string): string {
  const safeName = identifiedName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return `documentos/pendentes/${tipo}/${ano}/${mes}/${safeName}_p${pageNumbers.join('-')}.pdf`;
}

// --- Funções de Validação e Histórico ---

/**
 * Encontra documentos duplicados para o mesmo tipo, mês e ano.
 */
export async function findDuplicateDocuments(tipo: DocumentType, mes: number, ano: number): Promise<Documento[]> {
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("tipo", tipo)
    .eq("mes", mes)
    .eq("ano", ano);

  if (error) {
    console.error("Erro ao buscar duplicatas:", error);
    return [];
  }
  return (data ?? []) as Documento[];
}

/**
 * Constrói o histórico mensal de documentos.
 */
export function buildMonthlyHistory(docs: Documento[], tipo: DocumentType, months: number): MonthlyHistoryItem[] {
  const history: MonthlyHistoryItem[] = [];
  const today = new Date();
  let currentMonth = today.getMonth() + 1;
  let currentYear = today.getFullYear();

  for (let i = 0; i < months; i++) {
    const monthDocs = docs.filter(d => d.mes === currentMonth && d.ano === currentYear && d.tipo === tipo);
    let status: "ok" | "faltando" | "duplicado" = "faltando";

    if (monthDocs.length > 0) {
      status = monthDocs.length > 1 ? "duplicado" : "ok";
    }

    history.push({
      mes: currentMonth,
      ano: currentYear,
      status: status,
      total: monthDocs.length,
    });

    currentMonth--;
    if (currentMonth === 0) {
      currentMonth = 12;
      currentYear--;
    }
  }

  return history.reverse();
}

// --- Funções de Extração e Match ---

/**
 * Encontra o melhor perfil correspondente para o texto da página.
 * Prioriza CPF, Matrícula e Nome.
 * @param pageText O texto extraído da página do PDF.
 * @param profiles A lista de perfis ativos para comparação.
 * @param unidadeId O ID da unidade para filtrar os perfis.
 * @returns O melhor match encontrado ou null.
 */
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