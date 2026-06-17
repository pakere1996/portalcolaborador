import { FolhaPontoParser } from "./parsers/folha-ponto-parser";
import { ContrachequeParser } from "./parsers/contracheque-parser";
import { PageText } from "./pdf-utils";
import { ProfileForMatching } from "./parsers/document-parsers";

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

function createPageText(text: string, pageNumber: number = 1): PageText {
  return { pageNumber, text };
}

// Testes simplificados para validar a estrutura
console.log("Iniciando testes de parsers...");