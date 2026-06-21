import { PageResult, ProfileForMatching } from "@/components/DocumentImportForm";

/**
 * Parser para folhas de ponto
 */
export const parseFolhaPonto = (
  page: { pageNumber: number; text: string },
  profiles: ProfileForMatching[]
): PageResult => {
  const text = page.text;
  const nomeMatch = text.match(/Colaborador:\s*([^\n]+)/i);
  const cpfMatch = text.match(/CPF:\s*([\d.]+)/i);
  const mesMatch = text.match(/Período:\s*(\d{1,2})/i);
  const anoMatch = text.match(/Ano:\s*(\d{4})/i);
  const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);

  const nome = nomeMatch ? nomeMatch[1].trim() : null;
  const cpf = cpfMatch ? cpfMatch[1].trim() : null;
  const mes = mesMatch ? parseInt(mesMatch[1]) : null;
  const ano = anoMatch ? parseInt(anoMatch[1]) : null;
  const cnpj = cnpjMatch ? cnpjMatch[0] : null;

  let matchedProfile: ProfileForMatching | null = null;
  if (nome) {
    matchedProfile = profiles.find(p => p.nome.toLowerCase().includes(nome.toLowerCase())) || null;
  }

  return {
    pageNumber: page.pageNumber,
    text,
    nome,
    cnpj,
    mes,
    ano,
    unidadeId: null,
    matchStatus: matchedProfile ? "automatico" : "revisao",
    matchedProfile,
    resolvido: !!matchedProfile,
    ignorado: false,
    aprovado: false,
    duplicadoId: null,
    acaoSeDuplicado: null,
  };
};