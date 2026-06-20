import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { extractCPF, findBestProfileMatch } from "../documentos-matching";
import { extractPeriodo } from "../documentos";

export class ContrachequeParser implements DocumentParser {
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[] {
    return pages.map((p) => {
      const text = p.text;

      // Logs de diagnóstico para auditoria de texto bruto
      console.log(`[Parser] Processando página ${p.pageNumber}`);

      const nome = this.extractNome(text);
      const cpf = extractCPF(text);
      const matricula = this.extractMatricula(text);
      const periodo = this.extractPeriodoContracheque(text);
      const cnpj = this.extractCNPJ(text);
      const cargoTexto = this.extractCargo(text);
      const regimeTrabalho = this.extractRegimeTrabalho(text);
      const dataAdmissao = this.extractDataAdmissao(text, periodo);
      
      // Vínculo automático priorizando Matrícula e CPF
      const match = findBestProfileMatch(nome, cpf, profiles as any, matricula);
      const perfilVinculado = match.profile;

      console.log(`[Parser] Extração concluída: Nome=${nome}, Matrícula=${matricula}, Cargo=${cargoTexto}, Match=${match.status}`);

      return {
        pageNumber: p.pageNumber,
        text,
        nome,
        cpf,
        matricula,
        cnpj,
        mes: periodo?.mes ?? null,
        ano: periodo?.ano ?? null,
        unidadeId: null,
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
    // Padrão 1: Nome após label explícito
    const patterns = [
      /Nome\s*do\s*Funcion[aá]rio\s*[:]?\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
      /Nome\s*[:]\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
      /Empregado\s*[:]\s*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const capturado = match[1].trim().replace(/\s+/g, " ");
        if (capturado.length > 5 && !/^(CBO|MENSALISTA|HORISTA)/i.test(capturado)) {
          return capturado;
        }
      }
    }

    // Padrão 2: Texto em caixa alta com mais de 10 caracteres que não seja label técnico
    // Geralmente o nome é o maior bloco de texto em caixa alta no topo
    const uppercaseBlocks = text.match(/\b[A-ZÀ-ÚÇ\s]{10,}\b/g);
    if (uppercaseBlocks) {
      for (const block of uppercaseBlocks) {
        const clean = block.trim();
        if (clean.length > 10 && 
            !clean.includes("PAKERÊ") && 
            !clean.includes("CONTRACHEQUE") &&
            !/^(CBO|MENSALISTA|HORISTA|COMPETENCIA|REFERENCIA)/i.test(clean)) {
          return clean;
        }
      }
    }

    return null;
  }

  private extractMatricula(text: string): string | null {
    const patterns = [
      /(?:Matr[ií]cula|Registro|C[oó]digo)\s*[:]?\s*(\d+)/i,
      /\bC[oó]d\.\s*(\d+)\b/i,
      // Tenta pegar o primeiro número pequeno (1-5 dígitos) que aparece perto do nome
      /\b(\d{1,6})\b\s+[A-ZÀ-ÚÇ]{5,}/ 
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
    if (/\bHorista\b/i.test(text)) return "Horista";
    if (/\bMensalista\b/i.test(text)) return "Mensalista";
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
      /(?:Cargo|Fun[çc][ãa]o)\s*[:]?\s*([A-Za-zÀ-ÿÇç\s\./-]+)/i,
      /Descri[çc][ãa]o\s*[:]?\s*([A-Za-zÀ-ÿÇç\s\./-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let cargo = match[1].trim();
        // Limpeza de labels que podem ter sido capturados juntos
        cargo = cargo.split(/(?:\s{2,}|CBO|Data|Dep|Unidade|\n|$)/i)[0].trim();
        if (cargo.length > 3) return cargo;
      }
    }

    return null;
  }

  private extractDataAdmissao(text: string, periodo: { mes: number; ano: number } | null): string | null {
    const patterns = [
      /(?:Admiss[ãa]o|Adm)[:\s]*(\d{2})\/(\d{2})\/(\d{4})/i,
      /Data\s+Ingresso\s*[:]\s*(\d{2})\/(\d{2})\/(\d{4})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return null;
  }
}