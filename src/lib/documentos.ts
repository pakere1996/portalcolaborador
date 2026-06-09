import * as pdfjsLib from "pdfjs-dist";
import { GlobalWorkerOptions } from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

// Configuração do worker do PDF.js
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
}

export interface PageResult {
  pageNumber: number;
  text: string;
  status: "auto" | "manual" | "pending";
  profileId?: string;
  profileName?: string;
  score?: number;
  identifiedName: string;
  storagePath?: string;
}

export interface UploadStats {
  auto: number;
  manual: number;
  pending: number;
  total: number;
}

// Funções utilitárias
export function normalizeText(value: string): string {
  return (value ?? "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatDocMonth(mes: number, ano: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function getDocumentStoragePath(colaboradorId: string, tipo: DocumentType, ano: number, mes: number): string {
  return `documentos/${colaboradorId}/${tipo}/${ano}-${String(mes).padStart(2, "0")}.pdf`;
}

export function getPendingDocumentStoragePath(tipo: DocumentType, ano: number, mes: number, pageNumbers: number[], identifiedName: string): string {
  const slug = normalizeText(identifiedName).replace(/\s+/g, "-").slice(0, 50);
  return `documentos/pendentes/${tipo}/${ano}-${String(mes).padStart(2, "0")}/${pageNumbers.join("-")}-${slug}.pdf`;
}

// Similaridade de texto
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
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[b.length][a.length];
}

export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  
  // Se um é substring do outro, retorna 1
  if (a.includes(b) || b.includes(a)) return 1;
  
  const max = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / max;
}

// Extração de texto do PDF
export async function extractPdfText(file: File): Promise<{ pageNumber: number; text: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const pages: { pageNumber: number; text: string }[] = [];
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item: any) => "str" in item ? item.str : "").join(" ");
    pages.push({ pageNumber: i, text });
  }
  
  return pages;
}

// Cria PDF de uma única página
export async function createSinglePagePdf(file: File, pageNumber: number): Promise<Blob> {
  const originalPdf = await PDFDocument.load(await file.arrayBuffer());
  const newPdf = await PDFDocument.create();
  
  const [page] = await newPdf.copyPages(originalPdf, [pageNumber - 1]);
  newPdf.addPage(page);
  
  const bytes = await newPdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}

// Cria PDF mesclado de múltiplas páginas
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

// Encontra melhor correspondência de perfil
export function findBestProfileMatch(pageText: string, profiles: Profile[]): { profile: Profile; score: number; matchedText: string } | null {
  const page = normalizeText(pageText);
  let bestMatch: { profile: Profile; score: number; matchedText: string } | null = null;
  
  for (const profile of profiles) {
    if (!profile.nome) continue;
    
    const profileName = normalizeText(profile.nome);
    let score = similarity(page, profileName);
    
    // Verifica se todos os tokens significativos do nome estão no texto
    const tokens = profileName.split(" ").filter(t => t.length > 2);
    if (tokens.length >= 2 && tokens.every(t => page.includes(t))) {
      score = Math.max(score, 0.92);
    }
    
    // Se o nome completo está no texto, dá score máximo
    if (page.includes(profileName)) {
      score = 1;
    }
    
    if (score > 0.82 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { profile, score, matchedText: profile.nome };
    }
  }
  
  return bestMatch;
}

// Gera nome identificado a partir do texto
export function guessNameFromText(text: string): string {
  const lines = text.split(/\n+/).map((line: string) => line.trim()).filter(Boolean);
  const firstLine = lines[0]?.slice(0, 80) || "";
  return firstLine || "Colaborador não identificado";
}