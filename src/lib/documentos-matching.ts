import { Profile } from "@/integrations/supabase/types";

export interface ProfileForMatching {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
}

export interface MatchResult {
  profile: ProfileForMatching | null;
  matchBy: "cpf" | "nome" | "matricula" | "none";
  confidence: number;
  status: "automatico" | "sugerido" | "revisao";
}

/**
 * Extrai CPF de um texto (formato XXX.XXX.XXX-XX ou apenas números)
 */
export function extractCPF(text: string): string | null {
  // Procura por CPF formatado
  const formattedMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  if (formattedMatch) return formattedMatch[0];

  // Procura por 11 dígitos consecutivos (CPF sem formatação)
  const digitsMatch = text.match(/\b\d{11}\b/);
  if (digitsMatch) {
    const cpf = digitsMatch[0];
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }

  return null;
}

/**
 * Extrai CPF de texto (alias para compatibilidade)
 */
export function extractCPFFromText(text: string): string | null {
  return extractCPF(text);
}

/**
 * Calcula similaridade entre duas strings (Levenshtein simplificado)
 */
function similarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim();
  const bNorm = b.toLowerCase().trim();
  
  if (aNorm === bNorm) return 1;
  if (!aNorm || !bNorm) return 0;
  
  const longer = aNorm.length > bNorm.length ? aNorm : bNorm;
  const shorter = aNorm.length > bNorm.length ? bNorm : aNorm;
  
  let matchCount = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matchCount++;
  }
  
  return matchCount / longer.length;
}

/**
 * Encontra o melhor match de perfil baseado em nome e CPF
 */
export function findBestProfileMatch(
  nomePdf: string | null,
  cpfPdf: string | null,
  profiles: ProfileForMatching[]
): MatchResult {
  // 1. Prioridade absoluta: CPF exato
  if (cpfPdf) {
    const cpfMatch = profiles.find(p => p.cpf === cpfPdf);
    if (cpfMatch) {
      return {
        profile: cpfMatch,
        matchBy: "cpf",
        confidence: 1.0,
        status: "automatico"
      };
    }
  }

  // 2. Match por nome (similaridade alta)
  if (nomePdf) {
    let bestMatch: ProfileForMatching | null = null;
    let bestScore = 0;

    for (const profile of profiles) {
      const score = similarity(nomePdf, profile.nome);
      if (score > bestScore && score > 0.8) {
        bestScore = score;
        bestMatch = profile;
      }
    }

    if (bestMatch) {
      return {
        profile: bestMatch,
        matchBy: "nome",
        confidence: bestScore,
        status: bestScore >= 0.95 ? "automatico" : "sugerido"
      };
    }
  }

  // 3. Match por matrícula (se disponível no PDF)
  // Nota: a matrícula não é extraída automaticamente aqui, mas poderia ser adicionada

  return {
    profile: null,
    matchBy: "none",
    confidence: 0,
    status: "revisao"
  };
}