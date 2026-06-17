import { Profile } from "@/integrations/supabase/types";

export interface ProfileForMatching {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
}

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

export function extractCPFFromText(text: string): string | null {
  return extractCPF(text);
}

function cpfDifference(cpf1: string, cpf2: string): number {
  const c1 = cpf1.replace(/\D/g, "");
  const c2 = cpf2.replace(/\D/g, "");
  
  if (c1.length !== 11 || c2.length !== 11) return 999;

  let diff = 0;
  for (let i = 0; i < 11; i++) {
    if (c1[i] !== c2[i]) diff++;
  }
  return diff;
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
  profiles: Profile[]
): MatchResult {
  const cpfLimpo = cpfPDF?.replace(/\D/g, "") || "";
  const nomeNormalizado = nomePDF ? normalizeText(nomePDF) : "";

  // 1. CPF EXATO (Prioridade Máxima)
  if (cpfLimpo.length === 11) {
    const cpfExato = profiles.find(p => p.cpf?.replace(/\D/g, "") === cpfLimpo);
    if (cpfExato) {
      return { profile: cpfExato, matchBy: "cpf", confidence: 1, status: "automatico" };
    }
  }

  // 2. Busca por similaridade (CPF próximo + Nome compatível)
  let melhorPerfil: Profile | null = null;
  let maiorConfianca = 0;
  let matchTipo = "novo";

  for (const profile of profiles) {
    const cpfBanco = profile.cpf?.replace(/\D/g, "") || "";
    const diff = cpfLimpo.length === 11 ? cpfDifference(cpfBanco, cpfLimpo) : 999;
    const simNome = nomeNormalizado ? calculateNameSimilarity(nomeNormalizado, profile.nome || "") : 0;

    // Se o CPF for muito parecido (até 2 dígitos de erro) e o nome bater minimamente
    if (diff <= 2 && simNome >= 0.5) {
      return { profile, matchBy: "cpf_proximo", confidence: 0.9, status: "sugerido" };
    }

    // Se o nome for muito parecido (75% dos tokens) mesmo sem CPF
    if (simNome >= 0.75 && simNome > maiorConfianca) {
      maiorConfianca = simNome;
      melhorPerfil = profile;
      matchTipo = "nome";
    }
  }

  if (melhorPerfil && maiorConfianca >= 0.75) {
    return { profile: melhorPerfil, matchBy: matchTipo, confidence: maiorConfianca, status: "sugerido" };
  }

  return { profile: null, matchBy: "novo", confidence: 0, status: "novo_colaborador" };
}