import { Profile } from "@/integrations/supabase/types";

export interface MatchResult {
  profile: Profile | null;
  matchBy: string;
  confidence: number;
  status: string;
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function extractCPF(text: string): string | null {
  const formattedMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  if (formattedMatch) return formattedMatch[0];

  const digitsMatch = text.match(/\b\d{11}\b/);
  if (digitsMatch) {
    const cpf = digitsMatch[0];
    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }
  return null;
}

function calculateNameSimilarity(nomePdf: string, nomeBanco: string): number {
  const tokensBanco = normalizeText(nomeBanco).split(" ").filter(t => t.length >= 3);
  const textPdf = normalizeText(nomePdf);

  if (tokensBanco.length === 0) return 0;

  const encontrados = tokensBanco.filter(token => textPdf.includes(token));
  return encontrados.length / tokensBanco.length;
}

export function findBestProfileMatch(
  nomePDF: string | null,
  cpfPDF: string | null,
  profiles: Profile[],
  matriculaPDF: string | null = null
): MatchResult {
  const cpfLimpo = cpfPDF?.replace(/\D/g, "") || "";
  const nomeNormalizado = nomePDF ? normalizeText(nomePDF) : "";
  const matriculaLimpa = matriculaPDF?.trim() || "";

  // 1. PRIORIDADE MÁXIMA: MATRÍCULA EXATA
  if (matriculaLimpa) {
    const matchMatricula = profiles.find(p => p.matricula === matriculaLimpa);
    if (matchMatricula) {
      return { profile: matchMatricula, matchBy: "matricula", confidence: 1, status: "automatico" };
    }
  }

  // 2. SEGUNDA PRIORIDADE: CPF EXATO
  if (cpfLimpo.length === 11) {
    const matchCpf = profiles.find(p => p.cpf?.replace(/\D/g, "") === cpfLimpo);
    if (matchCpf) {
      return { profile: matchCpf, matchBy: "cpf", confidence: 1, status: "automatico" };
    }
  }

  // 3. TERCEIRA PRIORIDADE: SIMILARIDADE DE NOME (Mínimo 80%)
  if (nomeNormalizado) {
    let melhorPerfil: Profile | null = null;
    let maiorConfianca = 0;

    for (const profile of profiles) {
      const simNome = calculateNameSimilarity(nomeNormalizado, profile.nome || "");
      if (simNome > maiorConfianca) {
        maiorConfianca = simNome;
        melhorPerfil = profile;
      }
    }

    if (melhorPerfil && maiorConfianca >= 0.8) {
      return { 
        profile: melhorPerfil, 
        matchBy: "nome", 
        confidence: maiorConfianca, 
        status: maiorConfianca >= 0.95 ? "automatico" : "sugerido" 
      };
    }
  }

  return { profile: null, matchBy: "novo", confidence: 0, status: "novo_colaborador" };
}