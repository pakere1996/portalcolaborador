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

  console.log(`[Match Diagnostic] Extracted Data:`, extractedData);
  console.log(`[Match Diagnostic] Target Unit ID:`, unidadeId);

  // 1. Filtrar perfis pela unidade selecionada
  const filteredProfiles = profiles.filter(p => p.unidade_id === unidadeId);

  console.log(`[Match Diagnostic] Filtered Profiles Count:`, filteredProfiles.length);
  console.log(`[Match Diagnostic] Filtered Profiles IDs/Units:`, filteredProfiles.map(p => ({ id: p.id, nome: p.nome, unidade_id: p.unidade_id })));


  if (filteredProfiles.length === 0) {
    return null;
  }

  // 2. Tentar match por CPF (Prioridade 1)
  if (extractedData.cpf) {
    const cleanedCpf = onlyDigits(extractedData.cpf);
    const match = filteredProfiles.find((p) => onlyDigits(p.cpf) === cleanedCpf);
    if (match) {
      console.log(`[Match Diagnostic] Match encontrado por CPF: ${match.nome}`);
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
      console.log(`[Match Diagnostic] Match encontrado por Matrícula: ${match.nome}`);
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
      console.log(`[Match Diagnostic] Match encontrado por Nome (Score: ${maxScore.toFixed(2)}): ${bestNameMatch.nome}`);
      bestMatch = { profile: bestNameMatch, score: maxScore };
    }
  }

  if (!bestMatch) {
    console.log("[Match Diagnostic] Nenhum match encontrado após filtros.");
  }

  return bestMatch;
}

/**
 * Extrai dados estruturados (Nome, CPF, Matrícula, Cargo, Unidade) do texto.
// ... existing code ...