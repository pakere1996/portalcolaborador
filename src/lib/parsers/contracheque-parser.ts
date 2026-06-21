import { PageResult } from "@/components/DocumentImportForm";

interface PageData {
  pageNumber: number;
  text: string;
}

interface ProfileMatch {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
  unidade_id: string | null;
  possui_folha_ponto?: boolean;
  regime_trabalho?: string | null;
}

/**
 * Analisa as páginas de um contracheque e tenta extrair informações relevantes
 * para vincular a um colaborador.
 */
export const parseContracheque = (
  pages: PageData[],
  profiles: ProfileMatch[]
): PageResult[] => {
  return pages.map((p) => {
    const text = p.text;
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    
    // Tenta identificar nome do colaborador no texto
    let nome: string | null = null;
    let cpf: string | null = null;
    let matricula: string | null = null;
    let cnpj: string | null = null;
    let mes: number | null = null;
    let ano: number | null = null;
    let unidadeId: string | null = null;
    let matchedProfile: ProfileMatch | null = null;

    // Procura por padrões comuns em contracheques
    for (const line of lines) {
      // Procura por nome (normalmente nas primeiras linhas)
      if (!nome && line.length > 5 && line.length < 60) {
        const nomeCandidato = line.trim();
        if (!/^\d/.test(nomeCandidato) && !/^(?:total|vencimento|desconto|salário)/i.test(nomeCandidato)) {
          nome = nomeCandidato;
        }
      }

      // Procura por CPF
      if (!cpf) {
        const cpfMatch = line.match(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
        if (cpfMatch) {
          cpf = cpfMatch[0];
        }
      }

      // Procura por CNPJ da empresa
      if (!cnpj) {
        const cnpjMatch = line.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        if (cnpjMatch) {
          cnpj = cnpjMatch[0];
        }
      }

      // Procura por matrícula
      if (!matricula) {
        const matriculaMatch = line.match(/matr[ií]cula\s*[:.]?\s*(\d+)/i);
        if (matriculaMatch) {
          matricula = matriculaMatch[1];
        }
      }

      // Procura por período (mês/ano)
      if (!mes || !ano) {
        const periodoMatch = line.match(/(\d{2})\/(\d{4})/);
        if (periodoMatch) {
          mes = parseInt(periodoMatch[1]);
          ano = parseInt(periodoMatch[2]);
        }
      }
    }

    // Tenta encontrar match com algum perfil
    if (nome) {
      const nomeNormalizado = nome
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const matched = profiles.find((profile) => {
        const profileNome = profile.nome
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        return nomeNormalizado.includes(profileNome) || profileNome.includes(nomeNormalizado);
      });

      if (matched) {
        matchedProfile = matched;
      }
    }

    return {
      pageNumber: p.pageNumber,
      text: p.text,
      nome,
      cnpj,
      mes,
      ano,
      unidadeId: unidadeId || (matchedProfile?.unidade_id ?? null),
      matchStatus: matchedProfile ? "automatico" : "revisao",
      matchedProfile: matchedProfile || null,
      resolvido: !!matchedProfile,
      ignorado: false,
      aprovado: false,
      duplicadoId: null,
      acaoSeDuplicado: null,
    };
  });
};