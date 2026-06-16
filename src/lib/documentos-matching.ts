function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findBestProfileMatch(
  nomePDF: string | null,
  cpfPDF: string | null,
  profiles: Profile[]
) {

  const nomeNormalizado = normalizeText(nomePDF || "");
  const cpfPDFLimpo = (cpfPDF || "").replace(/\D/g, "");

  console.log("================================");
  console.log("NOME PDF:", nomePDF);
  console.log("CPF PDF:", cpfPDFLimpo);
  console.log("================================");

  // =====================================================
  // ETAPA 1 - CPF EXATO
  // =====================================================

  const cpfExato = profiles.find(profile =>
    (profile.cpf || "").replace(/\D/g, "") === cpfPDFLimpo
  );

  if (cpfExato) {

    console.log("MATCH POR CPF EXATO:", cpfExato.nome);

    return {
      profile: cpfExato,
      matchBy: "cpf",
      confidence: 1,
      status: "automatico"
    };
  }

  // =====================================================
  // ETAPA 2 - BUSCAR CPF MAIS PRÓXIMO
  // =====================================================

  let melhorPerfil: Profile | null = null;
  let menorDiferenca = 999;

  for (const profile of profiles) {

    const cpfBanco = (profile.cpf || "").replace(/\D/g, "");

    if (cpfBanco.length !== 11 || cpfPDFLimpo.length !== 11) {
      continue;
    }

    let diferencas = 0;

    for (let i = 0; i < 11; i++) {
      if (cpfBanco[i] !== cpfPDFLimpo[i]) {
        diferencas++;
      }
    }

    if (diferencas < menorDiferenca) {
      menorDiferenca = diferencas;
      melhorPerfil = profile;
    }
  }

  console.log("MENOR DIFERENCA CPF:", menorDiferenca);
  console.log("MELHOR PERFIL CPF:", melhorPerfil?.nome);

  // =====================================================
  // ETAPA 3 - CPF MUITO DIFERENTE
  // =====================================================

  if (menorDiferenca > 3 || !melhorPerfil) {

    console.log("NOVO COLABORADOR - CPF MUITO DIFERENTE");

    return {
      profile: null,
      matchBy: "none",
      confidence: 0,
      status: "revisao"
    };
  }

  // =====================================================
  // ETAPA 4 - VALIDAR NOME
  // =====================================================

  const nomeBanco = normalizeText(melhorPerfil.nome || "");

  const tokensBanco = nomeBanco
    .split(" ")
    .filter(token => token.length >= 3);

  const tokensEncontrados = tokensBanco.filter(token =>
    nomeNormalizado.includes(token)
  );

  const similaridadeNome =
    tokensBanco.length === 0
      ? 0
      : tokensEncontrados.length / tokensBanco.length;

  console.log("SIMILARIDADE NOME:", similaridadeNome);
  console.log("TOKENS ENCONTRADOS:", tokensEncontrados);

  // =====================================================
  // ETAPA 5 - NOME COMPATÍVEL
  // =====================================================

  if (similaridadeNome >= 0.75) {

    console.log("MATCH SUGERIDO:", melhorPerfil.nome);

    return {
      profile: melhorPerfil,
      matchBy: "cpf",
      confidence: similaridadeNome,
      status: "sugerido"
    };
  }

  // =====================================================
  // ETAPA 6 - NOVO COLABORADOR
  // =====================================================

  console.log("NOVO COLABORADOR - NOME NÃO COMPATÍVEL");

  return {
    profile: null,
    matchBy: "none",
    confidence: 0,
    status: "revisao"
  };
}