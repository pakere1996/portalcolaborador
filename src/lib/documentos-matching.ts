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
  nomePDF: string | null,
  cpfPDF: string | null,
  profiles: Profile[]
) {
  const nomeNormalizado = normalizeText(nomePDF || "");
  const cpfLimpo = cpfPDF?.replace(/\D/g, "") || "";

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
  // 2 - PROCURA CPF PARECIDO
  // ==========================================

  let melhorCPF: Profile | null = null;
  let menorDiferenca = 999;

  for (const profile of profiles) {
    const cpfBanco = profile.cpf?.replace(/\D/g, "");

    if (!cpfBanco || cpfBanco.length !== 11 || cpfLimpo.length !== 11) {
      continue;
    }

    let diferencas = 0;

    for (let i = 0; i < 11; i++) {
      if (cpfBanco[i] !== cpfLimpo[i]) {
        diferencas++;
      }
    }

    if (diferencas < menorDiferenca) {
      menorDiferenca = diferencas;
      melhorCPF = profile;
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

  if (!melhorCPF?.nome || !nomeNormalizado) {
    return {
      profile: null,
      matchBy: "novo",
      confidence: 0,
      status: "novo_colaborador"
    };
  }

  const nomeBanco = normalizeText(melhorCPF.nome);

  const tokensBanco = nomeBanco
    .split(" ")
    .filter(t => t.length >= 3);

  const tokensEncontrados = tokensBanco.filter(
    token => nomeNormalizado.includes(token)
  );

  const similaridade =
    tokensEncontrados.length / tokensBanco.length;

  // ==========================================
  // 5 - NOME COMPATÍVEL
  // ==========================================

  if (similaridade >= 0.75) {
    return {
      profile: melhorCPF,
      matchBy: "cpf+nome",
      confidence: similaridade,
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