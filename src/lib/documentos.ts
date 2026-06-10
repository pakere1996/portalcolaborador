import * as pdfjsLib from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

export type DocumentType = "contracheque" | "folha_ponto";

export interface Documento {
  id: string;
  colaborador_id: string | null;
  tipo: DocumentType;
  mes: number;
  ano: number;
  storage_path: string;
  status: "vinculado" | "pendente";
  nome_pdf: string;
  created_at: string;
}

export interface Profile {
  id: string;
  nome: string;
  cpf: string;
  matricula?: string | null; // Adicionado Matrícula
  unidade_id?: string | null;
}

export interface ExtractedData {
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cracha: string | null;
  cargo: string | null;
  unidade: string | null; // Nome da unidade
  departamento: string | null;
  centro_custo: string | null;
  data_nascimento: string | null; // Formato YYYY-MM-DD
  data_admissao: string | null; // Formato YYYY-MM-DD
}

export interface PageResult {
  pageNumber: number;
  text: string;
  status: "auto" | "manual" | "pending" | "suggested" | "linked";
  profileId?: string;
  profileName?: string;
  score?: number;
  identifiedName: string;
  extractedData?: ExtractedData; // Dados extraídos para pré-cadastro
  suggestionId?: string; // ID da sugestão se for um novo colaborador
  storagePath?: string;
}

export interface UploadStats {
  auto: number;
  manual: number;
  pending: number;
  total: number;
}

export interface ReferencePeriod {
  mes: number;
  ano: number;
  sourceText: string;
}

export interface MonthlyHistoryItem {
  mes: number;
  ano: number;
  total: number;
  status: "ok" | "faltando" | "duplicado";
}

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "agosto", // Duplicado para cobrir variações
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function normalizeText(value: string): string {
  return (value ?? "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDocMonth(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function getDocumentTypeLabel(type: DocumentType): string {
  return type === "contracheque" ? "Contracheque" : "Folha de Ponto";
}

export function getDocumentStoragePath(colaboradorId: string, tipo: DocumentType, ano: number, mes: number): string {
  return `documentos/${colaboradorId}/${tipo}/${ano}-${String(mes).padStart(2, "0")}.pdf`;
}

export function getPendingDocumentStoragePath(tipo: DocumentType, ano: number, mes: number, pageNumbers: number[], identifiedName: string): string {
  const slug = normalizeText(identifiedName).replace(/\s+/g, "-").slice(0, 50);
  return `documentos/pendentes/${tipo}/${ano}-${String(mes).padStart(2, "0")}/${pageNumbers.join("-")}-${slug}.pdf`;
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator,
      );
    }
  }

  return matrix[b.length][a.length];
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 1;

  const max = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / max;
}

export async function extractPdfText(file: File): Promise<{ pageNumber: number; text: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pages.push({ pageNumber: i, text });
  }

  return pages;
}

export async function createMergedPdf(file: File, pageNumbers: number[]): Promise<Blob> {
  const originalPdf = await PDFDocument.load(await file.arrayBuffer());
  const newPdf = await PDFDocument.create();

  for (const pageNum of pageNumbers) {
    const [page] = await newPdf.copyPages(originalPdf, [pageNum - 1]);
    newPdf.addPage(page);
  }

  const bytes = await newPdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}

/**
 * Tenta extrair dados estruturados (CPF, Matrícula, Cargo, etc.) do texto da página.
 */
export function extractStructuredData(text: string): ExtractedData {
  const normalized = normalizeText(text);
  const rawText = text;
  
  const data: ExtractedData = {
    nome: guessNameFromText(rawText) || "Nome não encontrado",
    cpf: null,
    matricula: null,
    cracha: null,
    cargo: null,
    unidade: null,
    departamento: null,
    centro_custo: null,
    data_nascimento: null,
    data_admissao: null,
  };

  // --- 1. Extrair CPF (11 dígitos) ---
  // Procura por 11 dígitos, com ou sem separadores comuns (., -)
  const cpfMatch = rawText.match(/(\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[-\s]?\d{2})/);
  if (cpfMatch) {
    data.cpf = cpfMatch[1].replace(/[\s\.\-]/g, '');
  }

  // --- 2. Extrair Matrícula/Crachá ---
  // Procura por palavras-chave seguidas por 4 a 10 dígitos
  const matriculaMatch = rawText.match(/(?:Matr[íi]cula|Registro|C[óo]digo|ID)\s*:?\s*(\d{4,10})/i);
  if (matriculaMatch) {
    data.matricula = matriculaMatch[1];
  }
  
  // Crachá (pode ser o mesmo que matrícula, mas mantemos separado se a regex for diferente)
  const crachaMatch = rawText.match(/(?:Crach[áa])\s*:?\s*(\d{4,10})/i);
  if (crachaMatch) {
    data.cracha = crachaMatch[1];
    if (!data.matricula) data.matricula = data.cracha; // Se crachá for encontrado e matrícula não, usa crachá como matrícula
  }

  // --- 3. Extrair Cargo ---
  // Procura por palavras-chave seguidas por texto (3 a 50 caracteres)
  // Melhorando a regex para capturar o texto do cargo de forma mais limpa
  const cargoMatch = rawText.match(/(?:Cargo|Fun[çc][ãa]o|Ocupa[çc][ãa]o)\s*:?\s*([A-Z][A-Za-z\s]{3,50})/i);
  if (cargoMatch) {
    data.cargo = cargoMatch[1].trim();
  } else {
    // Tentativa secundária: buscar texto após 'Cargo:' ou 'Função:'
    const secondaryCargoMatch = rawText.match(/(?:Cargo|Fun[çc][ãa]o)\s*:?\s*([A-Za-z\s]{3,50})/i);
    if (secondaryCargoMatch) {
      data.cargo = secondaryCargoMatch[1].trim();
    }
  }

  // --- 4. Extrair Unidade ---
  const unidadeMatch = rawText.match(/(?:Unidade|Filial|Local)\s*:?\s*([A-Z][A-Za-z\s]{3,50})/i);
  if (unidadeMatch) {
    data.unidade = unidadeMatch[1].trim();
  }

  // --- 5. Extrair Departamento ---
  const deptoMatch = rawText.match(/(?:Departamento|Setor)\s*:?\s*([A-Z][A-Za-z\s]{3,50})/i);
  if (deptoMatch) {
    data.departamento = deptoMatch[1].trim();
  }

  // --- 6. Extrair Centro de Custo ---
  const ccMatch = rawText.match(/(?:Centro de Custo|CC)\s*:?\s*([A-Za-z0-9\s]{3,50})/i);
  if (ccMatch) {
    data.centro_custo = ccMatch[1].trim();
  }

  // --- 7. Extrair Datas (Admissão/Nascimento) ---
  // Admissão
  const admissaoMatch = rawText.match(/(?:Data de Admiss[ãa]o|Admiss[ãa]o)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (admissaoMatch) {
    const [day, month, year] = admissaoMatch[1].split('/');
    data.data_admissao = `${year}-${month}-${day}`;
  }
  
  // Nascimento
  const nascimentoMatch = rawText.match(/(?:Data de Nascimento|Nascimento)\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (nascimentoMatch) {
    const [day, month, year] = nascimentoMatch[1].split('/');
    data.data_nascimento = `${year}-${month}-${day}`;
  }

  return data;
}

export function findBestProfileMatch(pageText: string, profiles: Profile[]): { profile: Profile; score: number; matchedText: string } | null {
  const extracted = extractStructuredData(pageText);
  const normalizedPage = normalizeText(pageText);
  let bestMatch: { profile: Profile; score: number; matchedText: string } | null = null;

  // 1. Prioridade: CPF
  if (extracted.cpf) {
    const match = profiles.find(p => normalizeText(p.cpf) === extracted.cpf);
    if (match) {
      return { profile: match, score: 1.0, matchedText: `CPF: ${extracted.cpf}` };
    }
  }

  // 2. Prioridade: Matrícula
  if (extracted.matricula) {
    const match = profiles.find(p => p.matricula === extracted.matricula);
    if (match) {
      return { profile: match, score: 0.98, matchedText: `Matrícula: ${extracted.matricula}` };
    }
  }

  // 3. Prioridade: Nome (Lógica de similaridade existente)
  for (const profile of profiles) {
    if (!profile.nome) continue;

    const profileName = normalizeText(profile.nome);
    let score = similarity(normalizedPage, profileName);

    const tokens = profileName.split(" ").filter((t) => t.length > 2);
    if (tokens.length >= 2 && tokens.every((t) => normalizedPage.includes(t))) {
      score = Math.max(score, 0.92);
    }

    if (normalizedPage.includes(profileName)) {
      score = 1;
    }

    if (score > 0.82 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { profile, score, matchedText: profile.nome };
    }
  }

  return bestMatch;
}

function extractFolhaPontoName(text: string): string | null {
  const upperText = (text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Procura por uma sequência de palavras em caixa alta (o nome) que não seja seguida imediatamente por um número curto (evitando crachá/matrícula no meio da linha)
  // Tentativa de capturar o nome completo antes de qualquer identificador numérico
  const match = upperText.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,})\b/);

  if (match && match[1].length > 5) {
    return match[1]
      .replace(/\s+/g, " ")
      .trim();
  }
  return null;
}

export function guessNameFromText(text: string, tipo?: DocumentType): string {
  if (tipo === "folha_ponto") {
    const folhaPontoName = extractFolhaPontoName(text);
    if (folhaPontoName) {
      return folhaPontoName;
    }
  }

  // Tenta extrair o nome de forma mais robusta
  const nameMatch = text.match(/(?:Nome|Colaborador|Funcion[áa]rio)\s*:?\s*([A-Za-z\s]{5,50})/i);
  if (nameMatch) {
    return nameMatch[1].trim();
  }

  const lines = text.split(/\n+/).map((line: string) => line.trim()).filter(Boolean);
  const firstLine = lines[0]?.slice(0, 80) || "";
  return firstLine || "Colaborador não identificado";
}

export function detectReferencePeriod(text: string, tipo?: DocumentType): ReferencePeriod | null {
  const rawText = text ?? "";
  const normalized = normalizeText(rawText);

  if (tipo === "folha_ponto") {
    const periodMatch = rawText.match(/Per[ií]odo\s+de\s+refer[êe]ncia\s*:?\s*de\s*(\d{2})\/(\d{2})\/(20\d{2})\s*[àa]\s*(\d{2})\/(\d{2})\/(20\d{2})/i);
    if (periodMatch) {
      return {
        mes: Number(periodMatch[2]),
        ano: Number(periodMatch[3]),
        sourceText: periodMatch[0],
      };
    }
  }

  const monthRegex = new RegExp(`\\b(${MONTH_NAMES.join("|")})\\s+de\\s+(20\\d{2})\\b`, "i");
  const monthMatch = normalized.match(monthRegex);
  if (monthMatch) {
    const mes = MONTH_NAMES.indexOf(monthMatch[1]) + 1;
    const ano = Number(monthMatch[2]);
    if (mes > 0) {
      return { mes, ano, sourceText: monthMatch[0] };
    }
  }

  const refRegex = /(?:periodo de referencia|referencia|competencia)\s*:?\s*(\d{2})\/(\d{2})\/(20\d{2})/i;
  const refMatch = normalized.match(refRegex);
  if (refMatch) {
    return {
      mes: Number(refMatch[2]),
      ano: Number(refMatch[3]),
      sourceText: refMatch[0],
    };
  }

  const genericDateRegex = /\b(\d{2})\/(\d{2})\/(20\d{2})\b/;
  const genericDateMatch = normalized.match(genericDateRegex);
  if (genericDateMatch) {
    return {
      mes: Number(genericDateMatch[2]),
      ano: Number(genericDateMatch[3]),
      sourceText: genericDateMatch[0],
    };
  }

  return null;
}

export function buildMonthlyHistory(docs: Documento[], tipo: DocumentType, monthsBack = 12): MonthlyHistoryItem[] {
  const now = new Date();
  const items: MonthlyHistoryItem[] = [];

  for (let offset = monthsBack - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const mes = date.getMonth() + 1;
    const ano = date.getFullYear();
    const total = docs.filter((doc) => doc.tipo === tipo && doc.mes === mes && doc.ano === ano).length;

    items.push({
      mes,
      ano,
      total,
      status: total === 0 ? "faltando" : total > 1 ? "duplicado" : "ok",
    });
  }

  return items;
}

export async function findDuplicateDocuments(tipo: DocumentType, mes: number, ano: number) {
  const { data, error } = await supabase
    .from("documentos")
    .select("*")
    .eq("tipo", tipo)
    .eq("mes", mes)
    .eq("ano", ano)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Documento[];
}

export function getPreviousMonthReference() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    mes: previous.getMonth() + 1,
    ano: previous.getFullYear(),
  };
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getFifthBusinessDay(year: number, monthIndex: number) {
  let count = 0;
  const date = new Date(year, monthIndex, 1);

  while (count < 5) {
    if (isBusinessDay(date)) {
      count += 1;
      if (count === 5) {
        return new Date(date);
      }
    }
    date.setDate(date.getDate() + 1);
  }

  return new Date(year, monthIndex, 7);
}

export async function syncAdminMonthlyDocumentReminder() {
  const today = new Date();
  const fifthBusinessDay = getFifthBusinessDay(today.getFullYear(), today.getMonth());
  const shouldShowReminder = today >= fifthBusinessDay;
  const { mes, ano } = getPreviousMonthReference();

  const [adminsRes, docsRes, existingRes] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "admin"),
    supabase.from("documentos").select("id, tipo").eq("mes", mes).eq("ano", ano),
    supabase
      .from("notificacoes")
      .select("id, user_id")
      .eq("tipo", "documentos_mensais_pendentes")
      .eq("payload->>mes", String(mes))
      .eq("payload->>ano", String(ano)),
  ]);

  if (adminsRes.error) throw adminsRes.error;
  if (docsRes.error) throw docsRes.error;
  if (existingRes.error) throw existingRes.error;

  const docs = (docsRes.data ?? []) as Pick<Documento, "id" | "tipo">[];
  const hasContracheque = docs.some((doc) => doc.tipo === "contracheque");
  const hasFolha = docs.some((doc) => doc.tipo === "folha_ponto");
  const completed = hasContracheque && hasFolha;

  const existing = existingRes.data ?? [];
  const adminIds = [...new Set((adminsRes.data ?? []).map((item) => item.user_id))];

  if (!shouldShowReminder || completed) {
    if (existing.length > 0) {
      const { error } = await supabase.from("notificacoes").delete().in("id", existing.map((item) => item.id));
      if (error) throw error;
    }
    return;
  }

  const existingByUser = new Set(existing.map((item) => item.user_id));
  const missingUsers = adminIds.filter((id) => !existingByUser.has(id));

  if (missingUsers.length === 0) return;

  const payload = {
    mes,
    ano,
    tiposPendentes: [
      !hasContracheque ? "contracheque" : null,
      !hasFolha ? "folha_ponto" : null,
    ].filter(Boolean),
  };

  const inserts = missingUsers.map((userId) => ({
    user_id: userId,
    titulo: "Lembrete de documentos mensais",
    mensagem: "Envie os documentos do mês anterior para remover este aviso.",
    link: "/admin/documentos",
    lida: false,
    tipo: "documentos_mensais_pendentes",
    payload,
  }));

  const { error } = await supabase.from("notificacoes").insert(inserts);
  if (error) throw error;
}