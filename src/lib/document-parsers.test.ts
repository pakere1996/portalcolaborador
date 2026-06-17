import { FolhaPontoParser } from "./folha-ponto-parser";
import { ContrachequeParser } from "./contracheque-parser";
import { PageText } from "./pdf-utils";
import { ProfileForMatching } from "./document-parsers";

// Mock profiles para testes
const mockProfiles: ProfileForMatching[] = [
  {
    id: "user-1",
    nome: "JOÃO SILVA SANTOS",
    cpf: "123.456.789-00",
    matricula: "001",
    cargo: "Atendente",
    unidade_id: "unidade-1",
  },
  {
    id: "user-2",
    nome: "MARIA OLIVEIRA",
    cpf: "987.654.321-00",
    matricula: "002",
    cargo: "Pizzaiolo",
    unidade_id: "unidade-1",
  },
];

// Textos de exemplo simulando extração de PDF
const folhaPontoText = `
PONTO ELETRÔNICO - EMPRESA PAKERÊ
Período de referência: de 01/01/2024 a 31/01/2024
01/01/2024 JOÃO SILVA SANTOS 001 ATENDENTE
02/01/2024 JOÃO SILVA SANTOS 001 ATENDENTE
CNPJ: 12.345.678/0001-90
Cargo/Função: Atendente
Admissão: 15/03/2020
`;

const contrachequeText = `
CONTRACHEQUE - PAKERÊ LTDA
Nome: JOÃO SILVA SANTOS
CPF: 123.456.789-00
Competência: Janeiro de 2024
CNPJ: 12.345.678/0001-90
Cargo: Atendente
Data Admissão: 15/03/2020
Salário Base: R$ 1.500,00
`;

const contrachequeTextAlt = `
HOLERITE - EMPRESA PAKERÊ
Colaborador: MARIA OLIVEIRA
CPF: 987.654.321-00
Referência: 02/2024
CNPJ: 12.345.678/0001-90
Função: Pizzaiolo
Admissão: 10/06/2019
`;

function createPageText(text: string, pageNumber: number = 1): PageText {
  return { pageNumber, text };
}

describe("FolhaPontoParser", () => {
  const parser = new FolhaPontoParser();

  it("deve extrair nome, CPF, período, CNPJ, cargo e data de admissão", () => {
    const pages = [createPageText(folhaPontoText)];
    const results = parser.parse(pages, mockProfiles);

    expect(results).toHaveLength(1);
    const result = results[0];

    expect(result.nome).toBe("JOÃO SILVA SANTOS");
    expect(result.cpf).toBe("123.456.789-00");
    expect(result.mes).toBe(1);
    expect(result.ano).toBe(2024);
    expect(result.cnpj).toBe("12.345.678/0001-90");
    expect(result.suggestedCargoName).toBe("Atendente");
    expect(result.dataAdmissao).toBe("2020-03-15");
    expect(result.matchStatus).toBe("automatico");
    expect(result.matchedProfile?.id).toBe("user-1");
    expect(result.confidence).toBe(1);
  });

  it("deve lidar com texto sem match de perfil", () => {
    const textSemMatch = folhaPontoText.replace("JOÃO SILVA SANTOS", "PEDRO ALMEIDA");
    const pages = [createPageText(textSemMatch)];
    const results = parser.parse(pages, mockProfiles);

    expect(results[0].matchedProfile).toBeNull();
    expect(result.matchStatus).toBe("novo_colaborador");
  });
});

describe("ContrachequeParser", () => {
  const parser = new ContrachequeParser();

  it("deve extrair nome, CPF, competência, CNPJ, cargo e data de admissão (padrão 1)", () => {
    const pages = [createPageText(contrachequeText)];
    const results = parser.parse(pages, mockProfiles);

    expect(results).toHaveLength(1);
    const result = results[0];

    expect(result.nome).toBe("JOÃO SILVA SANTOS");
    expect(result.cpf).toBe("123.456.789-00");
    expect(result.mes).toBe(1);
    expect(result.ano).toBe(2024);
    expect(result.cnpj).toBe("12.345.678/0001-90");
    expect(result.suggestedCargoName).toBe("Atendente");
    expect(result.dataAdmissao).toBe("2020-03-15");
    expect(result.matchStatus).toBe("automatico");
    expect(result.matchedProfile?.id).toBe("user-1");
  });

  it("deve extrair usando padrão alternativo (Colaborador/Referência)", () => {
    const pages = [createPageText(contrachequeTextAlt)];
    const results = parser.parse(pages, mockProfiles);

    expect(results[0].nome).toBe("MARIA OLIVEIRA");
    expect(results[0].cpf).toBe("987.654.321-00");
    expect(results[0].mes).toBe(2);
    expect(results[0].ano).toBe(2024);
    expect(results[0].suggestedCargoName).toBe("Pizzaiolo");
    expect(results[0].dataAdmissao).toBe("2019-06-10");
    expect(results[0].matchedProfile?.id).toBe("user-2");
  });

  it("deve lidar com CPF sem formatação", () => {
    const textCpfSemFormat = contrachequeText.replace("123.456.789-00", "12345678900");
    const pages = [createPageText(textCpfSemFormat)];
    const results = parser.parse(pages, mockProfiles);

    expect(results[0].cpf).toBe("123.456.789-00"); // Deve formatar
  });
});

describe("Integração - Strategy Pattern", () => {
  it("FolhaPontoParser e ContrachequeParser devem implementar DocumentParser", () => {
    const folhaParser = new FolhaPontoParser();
    const contraParser = new ContrachequeParser();

    // Ambos devem ter o método parse
    expect(typeof folhaParser.parse).toBe("function");
    expect(typeof contraParser.parse).toBe("function");

    // Ambos devem retornar PageResult[]
    const pages = [createPageText(folhaPontoText)];
    const folhaResults = folhaParser.parse(pages, mockProfiles);
    const contraParser.parse(pages, mockProfiles);

    expect(Array.isArray(folhaResults)).toBe(true);
    expect(Array.isArray(contraResults)).toBe(true);
    expect(folhaResults[0]).toHaveProperty("pageNumber");
    expect(contraResults[0]).toHaveProperty("pageNumber");
  });
});