import { PageResult, ProfileForMatching } from "@/components/DocumentImportForm";

/**
 * Parser para contracheques
 * Extrai informações relevantes do texto da página
 */
export const parseContracheque = (
  page: { pageNumber: number; text: string },
  profiles: ProfileForMatching[]
): PageResult => {
  // Lógica de extração (exemplo simplificado)
  const text = page.text;
  const nomeMatch = text.match(/Nome:\s*([^\n]+)/i);
  const cpfMatch = text.match(/CPF:\s*([\d.]+)/i);
  const mesMatch = text.match(/Mês:\s*(\d{1,2})/i);
  const anoMatch = text.match(/Ano:\s*(\d{4})/i);
  const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);

  const nome = nomeMatch ? nomeMatch[1].trim() : null;
  const cpf = cpfMatch ? cpfMatch[1].trim() : null;
  const mes = mesMatch ? parseInt(mesMatch[1]) : null;
  const ano = anoMatch ? parseInt(anoMatch[1]) : null;
  const cnpj = cnpjMatch ? cnpjMatch[0] : null;

  // Encontrar perfil correspondente (simples)
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
    unidadeId: null, // pode ser extraído do CNPJ
    matchStatus: matchedProfile ? "automatico" : "revisao",
    matchedProfile,
    resolvido: !!matchedProfile,
    ignorado: false,
    aprovado: false,
    duplicadoId: null,
    acaoSeDuplicado: null,
  };
};