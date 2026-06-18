import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { extractCPF, findBestProfileMatch } from "../documentos-matching";
import { extractPeriodo } from "../documentos";

export class FolhaPontoParser implements DocumentParser {
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[] {
    return pages.map((p) => {
      const text = p.text;

      const nameMatch = text.match(
        /\d{2}\/\d{2}\/\d{4}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+?)\s+\d+\s+[A-Z]/
      );
      const nome = nameMatch ? nameMatch[1].trim().replace(/\s+/g, " ") : null;

      const cpf = extractCPF(text);
      const periodo = this.extractPeriodoPonto(text);
      const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
      const cnpj = cnpjMatch ? cnpjMatch[0] : null;
      const cargoTexto = this.extractCargo(text);
      const dataAdmissao = this.extractDataAdmissao(text, periodo);
      const match = findBestProfileMatch(nome, cpf, profiles as any);
      const perfilVinculado = match.profile;

      return {
        pageNumber: p.pageNumber,
        text,
        nome,
        cpf,
        cnpj,
        mes: periodo?.mes ?? null,
        ano: periodo?.ano ?? null,
        unidadeId: null,
        cargo: null,
        regimeTrabalho: null,
        isNewCargo: false,
        suggestedCargoName: cargoTexto,
        dataAdmissao,
        matchStatus: match.status as "automatico" | "sugerido" | "revisao",
        matchedProfile: perfilVinculado as any,
        confidence: match.confidence,
        vinculado: false,
        ignorado: false,
      };
    });
  }

  private extractPeriodoPonto(text: string): { mes: number; ano: number } | null {
    const regex = /Periodo de referencia:\s*de\s*(\d{2})\/(\d{2})\/(\d{4})/i;
    const match = text.match(regex);
    if (match) {
      return { mes: parseInt(match[1]), ano: parseInt(match[3]) };
    }
    return extractPeriodo(text, "folha_ponto");
  }

  private extractCargo(text: string): string | null {
    const cargoMatch = text.match(
      /(?:cargo|fun[çc][ãa]o|cargo\/fun[çc][ãa]o)[:\s-]*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i
    );
    let cargoTexto = cargoMatch ? cargoMatch[1].replace(/\u00a0/g, " ").trim() : null;

    if (cargoTexto) {
      cargoTexto = cargoTexto.split(
        /(?:setor|dep|unidade|c\.|registro|s[eé]rie|hor[aá]rio|escala|cbo|pis|ctps|data|\s{2,})/i
      )[0].trim();
    }
    return cargoTexto;
  }

  private extractDataAdmissao(
    text: string,
    periodo: { mes: number; ano: number } | null
  ): string | null {
    const admissaoDireto = text.match(
      /(?:admiss[ãa]o|admissao|adm)[:\s]*[^0-9/]{0,20}(\d{2})\/(\d{2})\/(\d{4})/i
    );

    if (admissaoDireto) {
      return `${admissaoDireto[3]}-${admissaoDireto[2]}-${admissaoDireto[1]}`;
    }

    const todasAsDatas = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
    if (todasAsDatas.length > 0 && periodo) {
      const anoPeriodo = periodo.ano;
      let dataCandidata = todasAsDatas.find((d) => {
        const anoData = parseInt(d.split("/")[2]);
        return anoData < anoPeriodo;
      });

      if (!dataCandidata) {
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