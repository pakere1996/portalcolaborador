import { supabase } from "@/integrations/supabase/client";
import { Profile, SuggestedProfile, Documento, Unidade } from "@/integrations/supabase/types";
import { PDFDocument } from "pdf-lib";
import { toast } from "sonner";
import { getMonth, getYear } from "date-fns";

// --- Types ---

export type DocumentType = "folha_ponto" | "contracheque" | "atestado" | "disciplinar";

export interface ExtractedData {
  nome: string;
  cpf: string;
  matricula?: string;
  mes?: number;
  ano?: number;
  unidade_id: string;
}

export interface DocumentPage {
  pageIndex: number;
  text: string;
  extractedData: ExtractedData;
  suggestedProfile: SuggestedProfile | null;
  matchStatus: "matched" | "unmatched" | "duplicate";
  documentType: DocumentType;
}

// --- Date Extraction Logic ---

/**
 * Extracts month and year from the PDF text based on document type.
 * @param text The full text content of the PDF page.
 * @param type The type of document (folha_ponto or contracheque).
 * @returns { mes: number, ano: number } or null if not found.
 */
function extractMonthAndYear(text: string, type: DocumentType): { mes: number; ano: number } | null {
  const currentYear = new Date().getFullYear();

  if (type === "folha_ponto") {
    // Pattern: 'Período de referência: de DD/MM/AAAA à DD/MM/AAAA'
    const match = text.match(/Período de referência:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      
      // Use the month and year from the start date
      if (month >= 1 && month <= 12 && year > 2000) {
        console.log(`[DEBUG] Folha Ponto Date Match: ${day}/${month}/${year}`);
        return { mes: month, ano: year };
      }
    }
  } else if (type === "contracheque") {
    // Pattern: Month name followed by year (e.g., Fevereiro de 2026)
    const monthNames = [
      "janeiro", "fevereiro", "março", "abril", "maio", "junho",
      "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    
    // Regex to find month name followed by 'de' and a 4-digit year
    const monthYearRegex = new RegExp(`(${monthNames.join('|')})\\s+de\\s+(\\d{4})`, 'i');
    const match = text.toLowerCase().match(monthYearRegex);

    if (match) {
      const monthName = match[1];
      const year = parseInt(match[2], 10);
      const mes = monthNames.indexOf(monthName) + 1;

      if (mes > 0 && year > 2000) {
        console.log(`[DEBUG] Contracheque Date Match: ${monthName} (${mes}) of ${year}`);
        return { mes, ano: year };
      }
    }
  }

  // Fallback: If no specific pattern is found, try to find a generic MM/YYYY or YYYY pattern
  const genericMatch = text.match(/(\d{2})\/(\d{4})/);
  if (genericMatch) {
    const month = parseInt(genericMatch[1], 10);
    const year = parseInt(genericMatch[2], 10);
    if (month >= 1 && month <= 12 && year > 2000) {
      console.log(`[DEBUG] Generic Date Match: ${month}/${year}`);
      return { mes: month, ano: year };
    }
  }

  // If all else fails, use current month/year as a last resort (or null)
  return null;
}

// --- Profile Matching Logic ---

/**
 * Finds the best matching profile for the extracted data, strictly filtering by unit.
 * @param extractedData Data extracted from the PDF page.
 * @param allProfiles All active profiles available for matching.
 * @returns The best matching profile or null.
 */
export function findBestProfileMatch(
  extractedData: ExtractedData,
  allProfiles: Profile[]
): Profile | null {
  console.log("[Match Diagnostic] Starting profile match.");
  console.log("[Match Diagnostic] Extracted Data:", extractedData);

  const targetUnitId = extractedData.unidade_id;

  // 1. Filter profiles strictly by the selected unit and ensure they have a unit_id
  const unitFilteredProfiles = allProfiles.filter(p => 
    p.ativo === true && 
    p.unidade_id === targetUnitId
  );

  console.log(`[Match Diagnostic] Profiles filtered by Unit ID (${targetUnitId}): ${unitFilteredProfiles.length} profiles remaining.`);

  if (unitFilteredProfiles.length === 0) {
    console.log("[Match Diagnostic] No active profiles found for the selected unit.");
    return null;
  }

  // 2. Try matching by CPF (highest priority)
  if (extractedData.cpf) {
    const cpfMatch = unitFilteredProfiles.find(
      (p) => p.cpf === extractedData.cpf
    );
    if (cpfMatch) {
      console.log("[Match Diagnostic] Match found by CPF.");
      return cpfMatch;
    }
  }

  // 3. Try matching by Matricula
  if (extractedData.matricula) {
    const matriculaMatch = unitFilteredProfiles.find(
      (p) => p.matricula === extractedData.matricula
    );
    if (matriculaMatch) {
      console.log("[Match Diagnostic] Match found by Matricula.");
      return matriculaMatch;
    }
  }

  // 4. Try matching by Name (fuzzy match, lower priority)
  if (extractedData.nome) {
    const normalizedExtractedName = extractedData.nome.toLowerCase().trim();
    const nameMatch = unitFilteredProfiles.find((p) => {
      const normalizedProfileName = p.nome.toLowerCase().trim();
      // Simple check: profile name must be contained in the extracted name, or vice versa
      return (
        normalizedExtractedName.includes(normalizedProfileName) ||
        normalizedProfileName.includes(normalizedExtractedName)
      );
    });
    if (nameMatch) {
      console.log("[Match Diagnostic] Match found by Name (fuzzy).");
      return nameMatch;
    }
  }

  console.log("[Match Diagnostic] No match found for extracted data.");
  return null;
}

// --- Core Processing Function ---

/**
 * Processes a PDF file, extracts data page by page, and attempts to match profiles.
 * @param file The PDF file blob.
 * @param documentType The type of document being processed.
 * @param unidadeId The ID of the unit selected by the admin.
 * @returns A promise resolving to an array of DocumentPage objects.
 */
export async function processPdf(
  file: File,
  documentType: DocumentType,
  unidadeId: string
): Promise<DocumentPage[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const numPages = pdfDoc.getPageCount();
  const pages: DocumentPage[] = [];

  // Fetch all active profiles once
  const { data: allProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("ativo", true);

  if (profileError) {
    console.error("Error fetching profiles:", profileError);
    throw new Error("Failed to fetch collaborator profiles.");
  }

  // Fetch all suggested profiles (pending)
  const { data: suggestedProfiles, error: suggestedError } = await supabase
    .from("suggested_profiles")
    .select("*")
    .eq("status", "pending");

  if (suggestedError) {
    console.error("Error fetching suggested profiles:", suggestedError);
    throw new Error("Failed to fetch suggested profiles.");
  }

  const suggestedMap = new Map<string, SuggestedProfile>();
  suggestedProfiles.forEach(sp => {
    // Key by a combination of extracted data fields for quick lookup
    const key = `${sp.extracted_data.cpf || ''}-${sp.extracted_data.nome || ''}`;
    suggestedMap.set(key, sp);
  });


  for (let i = 0; i < numPages; i++) {
    // NOTE: PDF text extraction is complex and usually requires a dedicated library
    // Since we don't have a full PDF parser here, we rely on the mock/placeholder
    // text extraction provided by the environment or a simplified approach.
    // For this implementation, we assume 'pdf-lib' or similar provides basic text.
    // In a real TanStack Start app, this might be handled by a Server Function
    // using a Deno-compatible PDF parser.

    // Placeholder for text extraction (assuming we get text somehow)
    const pageText = `
      Página ${i + 1} de ${numPages}.
      Nome: João da Silva
      CPF: 123.456.789-00
      Matrícula: 98765
      Período de referência: de 01/05/2024 à 31/05/2024 (Folha Ponto)
      Fevereiro de 2026 (Contracheque)
    `;

    // Mock Extracted Data (Replace with actual extraction logic)
    const extractedData: ExtractedData = {
      nome: "João da Silva",
      cpf: "123.456.789-00",
      matricula: "98765",
      unidade_id: unidadeId, // Use the admin selected unit ID
    };

    // 1. Extract Month and Year
    const dateInfo = extractMonthAndYear(pageText, documentType);
    if (dateInfo) {
      extractedData.mes = dateInfo.mes;
      extractedData.ano = dateInfo.ano;
    } else {
      // If date cannot be extracted, we cannot proceed with matching/saving
      console.warn(`[DEBUG] Could not extract date for page ${i + 1}.`);
    }

    // 2. Find Best Profile Match
    let matchedProfile = findBestProfileMatch(extractedData, allProfiles);
    let matchStatus: DocumentPage['matchStatus'] = matchedProfile ? "matched" : "unmatched";

    // 3. Check for Duplicates if a match was found and date info exists
    if (matchedProfile && extractedData.mes && extractedData.ano) {
      const isDuplicate = await checkDuplicateDocument(
        matchedProfile.id,
        documentType,
        extractedData.mes,
        extractedData.ano,
        unidadeId
      );
      if (isDuplicate) {
        matchStatus = "duplicate";
        matchedProfile = null; // Treat as unmatched for processing flow
      }
    }

    // 4. Check for existing suggested profile if unmatched
    let suggestedProfile: SuggestedProfile | null = null;
    if (matchStatus === "unmatched") {
      const key = `${extractedData.cpf || ''}-${extractedData.nome || ''}`;
      suggestedProfile = suggestedMap.get(key) || null;
    }


    pages.push({
      pageIndex: i,
      text: pageText,
      extractedData,
      suggestedProfile,
      matchStatus,
      documentType,
    });
  }

  return pages;
}

/**
 * Checks if a document with the same collaborator, type, month, year, and unit already exists.
 */
async function checkDuplicateDocument(
  colaboradorId: string,
  tipo: DocumentType,
  mes: number,
  ano: number,
  unidadeId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("documentos")
    .select("id", { count: "exact", head: true })
    .eq("colaborador_id", colaboradorId)
    .eq("tipo", tipo)
    .eq("mes", mes)
    .eq("ano", ano)
    .eq("unidade_id", unidadeId);

  if (error) {
    console.error("Error checking for duplicates:", error);
    // If there's an error, assume no duplicate to allow processing, but log the error
    return false;
  }

  return count > 0;
}

/**
 * Saves the processed document to the database and storage.
 * @param page The processed document page data.
 * @param file The original PDF file.
 * @param profileId The ID of the collaborator to link the document to.
 * @param storagePath The path where the PDF page slice will be stored.
 */
export async function saveDocument(
  page: DocumentPage,
  file: File,
  profileId: string,
  storagePath: string
): Promise<Documento> {
  const { extractedData, documentType } = page;

  if (!extractedData.mes || !extractedData.ano) {
    throw new Error("Mês e ano são obrigatórios para salvar o documento.");
  }

  // 1. Save the document metadata to the database
  const { data: documentData, error: dbError } = await supabase
    .from("documentos")
    .insert({
      colaborador_id: profileId,
      tipo: documentType,
      mes: extractedData.mes,
      ano: extractedData.ano,
      unidade_id: extractedData.unidade_id,
      storage_path: storagePath,
      nome_pdf: file.name,
      status: "vinculado",
    })
    .select()
    .single();

  if (dbError) {
    console.error("Error saving document metadata:", dbError);
    throw new Error(`Falha ao salvar metadados do documento: ${dbError.message}`);
  }

  // 2. Upload the file slice to storage (Placeholder: we assume the full file is uploaded elsewhere)
  // In a real scenario, we would slice the PDF page and upload it.
  // For now, we just confirm the path.

  toast.success(`Documento de ${documentType} salvo para ${profileId}.`);
  return documentData;
}

/**
 * Creates a suggested profile entry for an unmatched document.
 */
export async function createSuggestedProfile(
  page: DocumentPage,
  documentId: string
): Promise<SuggestedProfile> {
  const { extractedData } = page;

  const { data, error } = await supabase
    .from("suggested_profiles")
    .insert({
      document_id: documentId,
      extracted_data: extractedData,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating suggested profile:", error);
    throw new Error("Falha ao criar sugestão de perfil.");
  }

  return data;
}