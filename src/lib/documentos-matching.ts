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

/**
 * Normaliza texto para comparação
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Extrai CPF do texto
 */
export function extractCPF(text: string): string | null {
  const formattedMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);

  if (formattedMatch) {
    return formattedMatch[0];
  }

  const digitsMatch = text.match(/\b\d{11}\b/);

  if (digitsMatch) {
    const cpf = digitsMatch[0];

    return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(
      6,
      9
    )}-${cpf.slice(9)}`;
  }

  return null;
}

/**
 * Compatibilidade com código legado
 */
export function extractCPFFromText(text: string): string | null {
  return extractCPF(text);
}

/**
 * Conta quantos dígitos são diferentes entre dois CPFs
 */
function cpfDifference(cpf1: string, cpf2: string): number {
  let diff = 0;

  for (let i = 0; i < 11; i++) {
    if (cpf1[i] !== cpf2[i]) {
      diff++;
    }
  }

  return diff;
}

/**
 * Similaridade por tokens do nome
 */
function calculateNameSimilarity(
  nomePdf: string,
  nomeBanco: string
): number {
  const tokensBanco = normalizeText(nomeBanco)
    .split(" ")
    .filter(t => t.length >= 3);

  const tokensPdf = normalizeText(nomePdf);

  const encontrados = tokensBanco.filter(
    token => tokensPdf.includes(token)
  );

  return encontrados.length / tokensBanco.length;
}

/**
 * Match principal
 */
export function findBestProfileMatch(
  nomePDF: string | null,
  cpfPDF: string | null,
  profiles: Profile[]
): MatchResult {

  const cpfLimpo = cpfPDF?.replace(/\D/g, "") || "";
  const nomeNormalizado = normalizeText(nomePDF || "");

  // ==========================================
  // 1 - CPF EXATO
  // ==========================================

  const cpfExato = profiles.find(
    p => p.cpf?.replace(/\D/g, "") === cpfLimpo
  );

  if (cpfExato) {
    return {
      profile: cpfExato,
      matchBy: "cpf",
      confidence: 1,
      status: "automatico"
    };
  }

  // ==========================================
  // 2 - ENCONTRA CPF MAIS PRÓXIMO
  // ==========================================

  let melhorPerfil: Profile | null = null;
  let menorDiferenca = 999;

  for (const profile of profiles) {
    const cpfBanco = profile.cpf?.replace(/\D/g, "");

    if (
      !cpfBanco ||
      cpfBanco.length !== 11 ||
      cpfLimpo.length !== 11
    ) {
      continue;
    }

    const diferenca = cpfDifference(
      cpfBanco,
      cpfLimpo
    );

    if (diferenca < menorDiferenca) {
      menorDiferenca = diferenca;
      melhorPerfil = profile;
    }
  }

  // ==========================================
  // 3 - CPF MUITO DIFERENTE
  // ==========================================

  if (menorDiferenca > 3) {
    return {
      profile: null,
      matchBy: "novo",
      confidence: 0,
      status: "novo_colaborador"
    };
  }

  // ==========================================
  // 4 - VALIDAR NOME
  // ==========================================

  if (
    !melhorPerfil ||
    !melhorPerfil.nome ||
    !nomeNormalizado
  ) {
    return {
      profile: null,
      matchBy: "novo",
      confidence: 0,
      status: "novo_colaborador"
    };
  }

  const similaridadeNome =
    calculateNameSimilarity(
      nomePDF || "",
      melhorPerfil.nome
    );

  // ==========================================
  // 5 - CPF PARECIDO + NOME COMPATÍVEL
  // ==========================================

  if (similaridadeNome >= 0.75) {
    return {
      profile: melhorPerfil,
      matchBy: "cpf+nome",
      confidence: similaridadeNome,
      status: "sugerido"
    };
  }

  // ==========================================
  // 6 - NOVO COLABORADOR
  // ==========================================

  return {
    profile: null,
    matchBy: "novo",
    confidence: 0,
    status: "novo_colaborador"
  };
}