import { supabase } from "@/integrations/supabase/client";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { ExtractedData, DocumentPage, DocumentType } from "./types";
import { cleanCNPJ, maskCNPJ } from "./utils";

/**
 * Extracts all CNPJ patterns from the given text.
 * Returns an array of cleaned 14‑digit CNPJ strings.
 */
function extractCNPJs(text: string): string[] {
  const cnpjRegex = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})|(\d{14})/g;
  const matches = text.match(cnpjRegex) || [];
  return matches.map(cleanCNPJ).filter(cnpj => cnpj.length === 14);
}

/**
 * Finds the unit ID that matches a given CNPJ.
 * If multiple units share the same CNPJ, the first match is returned.
 */
function findUnitByCNPJ(cnpj: string, unidades: any[]): string | null {
  const cleaned = cleanCNPJ(cnpj);
  const match = unidades.find(u => u.cnpj && cleanCNPJ(u.cnpj) === cleaned);
  return match ? match.id : null;
}

/**
 * Extracts month and year from the PDF text based on document type.
 * Returns { mes: number, ano: number } or null if not found.
 */
function extractMonthAndYear(text: string, type: DocumentType): { mes: number; ano: number } | null {
  const currentYear = new Date().getFullYear();

  if (type === "folha_ponto") {
    const match = text.match(/Período de referência:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (match) {
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      if (month >= 1 && month <= 12 && year > 2000) {
        return { mes: month, ano: year };
      }
    }
  } else if (type === "contracheque") {
    const monthNames = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const monthYearRegex = new RegExp(`(${monthNames.join('|')})\\s+de\\s+(\\d{4})`, "i");
    const match = text.toLowerCase().match(monthYearRegex);
    if (match) {
      const monthIndex = monthNames.indexOf(match[1].toLowerCase());
      const year = parseInt(match[2], 10);
      if (monthIndex > 0 && year > 2000) {
        return { mes: monthIndex + 1, ano: year };
      }
    }
  }

  // Fallback: try generic MM/YYYY pattern
  const generic = text.match(/(\d{2})\/(\d{4})/);
  if (generic) {
    const month = parseInt(generic[1], 10);
    const year = parseInt(generic[2], 10);
    if (month >= 1 && month <= 12 && year > 2000) {
      return { mes: month, ano: year };
    }
  }
  return null;
}

/**
 * Main processor: given a PDF file, its document type, and the admin‑selected unit,
 * returns an array of DocumentPage objects containing extracted data and the matched unidade_id.
 */
export async function processPdf(
  file: File,
  documentType: DocumentType,
  adminSelectedUnidadeId: string
): Promise<DocumentPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const numPages = pdfDoc.getPageCount();
  const extractedPages: DocumentPage[] = [];

  // Fetch all units once (used for CNPJ → unidade mapping)
  const { data: unidades, error: unidadeError } = await supabase
    .from("unidades")
    .select("*")
    .eq("ativo", true);
  if (unidadeError) throw new Error(`Failed to load unidades: ${unidadeError.message}`);

  // Fetch all profiles for later matching
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("ativo", true);
  if (profileError) throw new Error(`Failed to load profiles: ${profileError.message}`);

  for (let i = 0; i < numPages; i++) {
    const page = pdfDoc.getPage(i);
    const text = await page.getTextContent({ onlyText: true });
    const pageText = text.items.map(item => item.str).join(" ");

    // 1️⃣ Extract CNPJ(s) and pick the first that maps to a unit    const extractedCNPJs = extractCNPJs(pageText);
    let matchedUnidadeId: string | null = null;
    if (pageText.includes("CNPJ") || pageText.includes("cnpj")) {
      for (const cnpj of extractedCNPJs) {
        const unitId = findUnitByCNPJ(cnpj, unidades);
        if (unitId) {
          matchedUnidadeId = unitId;
          break;
        }
      }
    }

    // 2️⃣ If no unit found via CNPJ, fall back to the admin‑selected unit
    if (!matchedUnidadeId) {
      matchedUnidadeId = adminSelectedUnidadeId;
    }

    // 3️⃣ Extract month/year based on document type
    const dateInfo = extractMonthAndYear(pageText, documentType);
    const mes = dateInfo?.mes ?? null;
    const ano = dateInfo?.ano ?? null;

    // 4️⃣ Build the extracted data object
    const extractedData: ExtractedData = {
      nome: pageText.match(/Nome:\s*([^\n]+)/)?.[1]?.trim() ?? "",
      cpf: pageText.match(/CPF:\s*([^\n]+)/)?.[1]?.trim() ?? "",
      matricula: pageText.match(/Matrícula:\s*([^\n]+)/)?.[1]?.trim() ?? "",
      unidade_id: matchedUnidadeId,
      extracted_unidade_id: matchedUnidadeId, // expose for UI reference
      mes,
      ano,
    };

    // 5️⃣ Determine match status (matched / unmatched / duplicate)
    let matchStatus: DocumentPage["matchStatus"] = "unmatched";
    if (mes && ano && extractedData.cpf) {
      // Check for existing document with same colaborador, type, month, year, unidade
      const { count, error: duplicateError } = await supabase
        .from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", extractedData.cpf ?? "")
        .eq("tipo", documentType)
        .eq("mes", mes)
        .eq("ano", ano)
        .eq("unidade_id", matchedUnidadeId);
      if (duplicateError) throw new Error(`Duplicate check failed: ${duplicateError.message}`);
      matchStatus = count > 0 ? "duplicate" : "matched";
    }

    // 6️⃣ Assemble the DocumentPage object
    extractedPages.push({
      pageIndex: i,
      text: pageText,
      extractedData,
      matchStatus,
      documentType,
    });
  }

  return extractedPages;
}