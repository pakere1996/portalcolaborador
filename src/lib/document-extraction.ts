import type { ProfileForMatching } from "./document-parsers";
import type { ExtractedDocumentData } from "./extractions";

export async function extractFolhaPonto(
  text: string,
  profiles: ProfileForMatching[]
): Promise<ExtractedDocumentData> {
  console.log("[extractFolhaPonto] Raw PDF text:", text);
  console.log("[extractFolhaPonto] Lines:", splitTextLines(text));

  const nome = extractFolhaPontoName(text);
  const cpf = extractCPFWithKeywords(text);
  const periodo = extractPeriodoPonto(text);
  const cnpj = extractCNPJ(text);
  const cargo = extractCargo(text);
  const dataAdmissao = extractDataAdmissao(text, periodo);

  return buildExtractedData(
    nome,
    cpf,
    cnpj,
    periodo?.mes ?? null,
    periodo?.ano ?? null,
    cargo,
    dataAdmissao,
    profiles
  );
}

export async function extractContracheque(
  text: string,
  profiles: ProfileForMatching[]
): Promise<ExtractedDocumentData> {
  console.log("[extractContracheque] Raw PDF text:", text);
  console.log("[extractContracheque] Lines:", splitTextLines(text));

  const nome = extractNameNearKeywords(text, [
    "nome",
    "nome do colaborador",
    "nome do funcionário",
    "nome do funcionario",
    "funcionário",
    "funcionario",
    "colaborador",
    "empregado",
    "trabalhador",
  ]);
  const cpf = extractCPFWithKeywords(text);
  const periodo = extractPeriodoContracheque(text);
  const cnpj = extractCNPJ(text);
  const cargo = extractCargo(text);
  const dataAdmissao = extractDataAdmissao(text, periodo);

  return buildExtractedData(
    nome,
    cpf,
    cnpj,
    periodo?.mes ?? null,
    periodo?.ano ?? null,
    cargo,
    dataAdmissao,
    profiles
  );
}