import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { extractCPF, findBestProfileMatch } from "../documentos-matching";
import { extractPeriodo } from "../documentos";

export class ContrachequeParser implements DocumentParser {
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[] {
    return pages.map((p) => {
      const text = p.text;

      const nome = this.extractNome(text);
      const cpf = extractCPF(text);
      const matricula = this.extractMatricula(text);
      const periodo = this.extractPeriodoContracheque(text);
      const cnpj = this.extractCNPJ(text);
      const cargoTexto = this.extractCargo(text);
      const regimeTrabalho = this.extractRegimeTrabalho(text);
      const dataAdmissao = this.extractDataAdmissao(text, periodo);
      
      const match = findBestProfileMatch(nome, cpf, profiles as any, matricula);
      const perfilVinculado = match.profile;

      // Logs para diagnóstico conforme solicitado
      console.log("--- PÁGINA " + p.pageNumber + " ---");
      console.log("NOME EXTRAÍDO:", nome);
      console.log("CPF EXTRAÍDO:", cpf);
      console.log("MATRÍCULA EXTRAÍDA:", matricula);
      console.log("CARGO EXTRAÍDO:", cargoTexto);
      console.log("REGIME EXTRAÍDO:", regimeTrabalho);
      console.log("CNPJ EXTRAÍDO:", cnpj);
      console.log("MATCH ENCONTRADO:", match);

      return {
        pageNumber: p.pageNumber,
        text,
        nome,
        cpf,
        cnpj,
        mes: periodo?.mes ?? null,
        ano: periodo?.ano ?? null,
        unidadeId: null, // Será preenchido no frontend via matching de CNPJ
        cargo: null,
        regimeTrabalho,
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

  private extractNome(text: string): string | null {
    const patterns = [
      /Nome\s*do\s*Funcion[aá]rio\s*[:]?\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
      /Nome\s*[:]\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
      /Colaborador\s*[:]\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
      /Funcion[aá]rio\s*[:]\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
      /Empregado\s*[:]\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim().replace(/\s+/g, " ");
      }
    }

    // Fallback: Nome após o CPF
    const cpfMatch = text.match(/\d{3}\.\d{3}\.\d{3}-\d{2}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]{5,})/i);
    if (cpfMatch) {
      return cpfMatch[1].trim().replace(/\s+/g, " ");
    }

    return null;
  }

  private extractMatricula(text: string): string | null {
    const patterns = [
      /Matr[ií]cula\s*[:]?\s*(\d+)/i,
      /Registro\s*[:]?\s*(\d+)/i,
      /C[oó]digo\s*[:]?\s*(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private extractCNPJ(text: string): string | null {
    const match = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    return match ? match[0] : null;
  }

  private extractRegimeTrabalho(text: string): "Horista" | "Mensalista" | null {
    if (/Horista/i.test(text)) return "Horista";
    if (/Mensalista/i.test(text)) return "Mensalista";
    return null;
  }

  private extractPeriodoContracheque(text: string): { mes: number; ano: number } | null {
    const meses: Record<string, number> = {
      janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    };

    const regexMesAno = /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/i;
    let match = text.match(regexMesAno);
    if (match) {
      return { mes: meses[match[1].toLowerCase()], ano: parseInt(match[2]) };
    }

    const regexCompetencia = /(?:Compet[eê]ncia|Refer[eê]ncia|Per[ií]odo)[:\s]*(\d{2})\/(\d{4})/i;
    match = text.match(regexCompetencia);
    if (match) {
      return { mes: parseInt(match[1]), ano: parseInt(match[2]) };
    }

    return extractPeriodo(text, "contracheque");
  }

  private extractCargo(text: string): string | null {
    const patterns = [
      /Cargo\s*[:]?\s*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i,
      /Fun[çc][ãa]o\s*[:]?\s*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i,
      /Categoria\s*[:]?\s*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let cargo = match[1].replace(/\u00a0/g, " ").trim();
        // Pega apenas a primeira parte antes de múltiplos espaços ou quebra de linha
        cargo = cargo.split(/(?:\s{2,}|\n|$)/)[0].trim();
        return cargo;
      }
    }

    return null;
  }

  private extractDataAdmissao(
    text: string,
    periodo: { mes: number; ano: number } | null
  ): string | null {
    const patterns = [
      /(?:Admiss[ãa]o|Data\s+Admiss[ãa]o|Adm)[:\s]*(\d{2})\/(\d{2})\/(\d{4})/i,
      /Ingresso\s*[:]\s*(\d{2})\/(\d{2})\/(\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
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