import { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import { PageText } from "./pdf-utils";
import { extractCPF, findBestProfileMatch } from "./documentos-matching";
import { extractPeriodo } from "./documentos";

/**
 * Parser para Folhas de Ponto.
 * Extrai: nome, CPF, período (mês/ano), CNPJ/unidade, cargo, data de admissão.
 */
export class FolhaPontoParser implements DocumentParser {
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[] {
    return pages.map((p) => {
      const text = p.text;

      // 1. Nome do colaborador (padrão específico da folha de ponto)
      const nameMatch = text.match(
        /\d{2}\/\d{2}\/\d{4}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+?)\s+\d+\s+[A-Z]/
      );
      const nome = nameMatch ? nameMatch[1].trim().replace(/\s+/g, " ") : null;

      // 2. CPF
      const cpf = extractCPF(text);

      // 3. Período (mês/ano) - usa regex específica de folha de ponto
      const periodo = this.extractPeriodoPonto(text);

      // 4. CNPJ da unidade
      const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      const cnpj = cnpjMatch ? cnpjMatch[0] : null;

      // 5. Cargo (tentativa de extração)
      const cargoTexto = this.extractCargo(text);

      // 6. Data de admissão
      const dataAdmissao = this.extractDataAdmissao(text, periodo);

      // 7. Matching com perfil existente
      const match = findBestProfileMatch(nome, cpf, profiles);
      const perfilVinculado = match.profile;

      // 8. Verifica se o cargo extraído bate com algum cargo oficial
      // (a validação contra a base de cargos será feita no componente)

      return {
        pageNumber: p.pageNumber,
        text,
        nome,
        cpf,
        cnpj,
        mes: periodo?.mes ?? null,
        ano: periodo?.ano ?? null,
        unidadeId: null, // será preenchido no componente via CNPJ
        cargo: null,     // será preenchido no componente via matching de cargo
        isNewCargo: false,
        suggestedCargoName: cargoTexto,
        dataAdmissao,
        matchStatus: match.status as "automatico" | "sugerido" | "revisao",
        matchedProfile: perfilVinculado,
        confidence: match.confidence,
        vinculado: false,
        ignorado: false,
      };
    });
  }

  /**
   * Extrai período no formato "Período de referência: de DD/MM/YYYY a DD/MM/YYYY"
   */
  private extractPeriodoPonto(text: string): { mes: number; ano: number } | null {
    const regex = /Periodo de referencia:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i;
    const match = text.match(regex);
    if (match) {
      return { mes: parseInt(match[1]), ano: parseInt(match[3]) };
    }
    // Fallback genérico
    return extractPeriodo(text, "folha_ponto");
  }

  /**
   * Extrai cargo/função do texto da folha de ponto
   */
  private extractCargo(text: string): string | null {
    const cargoMatch = text.match(
      /(?:cargo|fun[çc][ãa]o|cargo\/fun[çc][ãa]o)[:\s-]*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i
    );
    let cargoTexto = cargoMatch ? cargoMatch[1].replace(/\u00a0/g, " ").trim() : null;

    if (cargoTexto) {
      // Remove tudo após palavras-chave que indicam fim do cargo
      cargoTexto = cargoTexto.split(
        /(?:setor|dep|unidade|c\.|registro|s[eé]rie|hor[aá]rio|escala|cbo|pis|ctps|data|\s{2,})/i
      )[0].trim();
    }
    return cargoTexto;
  };

  /**
   * Extrai data de admissão do texto
   */
  private extractDataAdmissao(
    text: string,
    periodo: { mes: number; ano: number } | null
  ): string | null {
    // Tenta encontrar "Admissão: DD/MM/YYYY" ou similar
    const admissaoDireto = text.match(
      /(?:admiss[ãa]o|admissao|adm)[:\s]*[^0-9/]{0,20}(\d{2})\/(\d{2})\/(\d{4})/i
    );

    if (admissaoDireto) {
      return `${admissaoDireto[3]}-${admissaoDireto[2]}-${admissaoDireto[1]}`;
    }

    // Fallback: pega a data mais antiga que seja anterior ao período do documento
    const todasAsDatas = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    if (todasAsDatas.length > 0 && periodo) {
      const anoPeriodo = periodo.ano;
      let dataCandidata = null;

      // Procura data com ano anterior ao período
      dataCandidata = todasAsDatas.find((d) => {
        const anoData = parseInt(d.split("/")[2]);
        return anoData < anoPeriodo;
      });

      if (!dataCandidata) {
        // Se não achou, pega a mais antiga
        const ordenadas = [...todasAsDatas].sort((a, b) => {
          const [dA, mA, aA] = a.split("/").map(Number);
          const [dB, mB, aB] = b.split("/").map(Number);
          return new Date(aA, mA - 1, dA).getTime() - new Date(aB, mB - 1, dB).getTime();
        });
        dataCandidata = ordenadas[0];
      }

      if (dataCandidata) {
        const [dia, mes, ano] = dataCandidata.split("/");
        return `${ano}-${mes}-${dia}`;
      }
    }

    return null;
  }
}