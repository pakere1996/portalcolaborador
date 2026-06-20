import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { extractCPF, findBestProfileMatch } from "../documentos-matching";
import { extractPeriodo } from "../documentos";

export class ContrachequeParser implements DocumentParser {
  parse(pages: PageText[], profiles: ProfileForMatching[]): PageResult[] {
    return pages.map((p) => {
      const text = p.text;
      
      // Extract header block first
      const headerBlock = this.extractHeaderBlock(text);
      
      // Extract data from header block only
      const nome = this.extractNome(headerBlock);
      const cpf = extractCPF(headerBlock);
      const matricula = this.extractMatricula(headerBlock);
      const cnpj = this.extractCNPJ(headerBlock);
      const competencia = this.extractCompetencia(headerBlock);
      const cargo = this.extractCargo(headerBlock);
      const regimeTrabalho = this.extractRegimeTrabalho(headerBlock);
      const dataAdmissao = this.extractDataAdmissao(headerBlock, competencia);
      
      // Match profile using extracted data
      const match = findBestProfileMatch(nome, cpf, profiles as any, matricula);
      const perfilVinculado = match.profile;

      return {
        pageNumber: p.pageNumber,
        text,
        nome,
        cpf,
        matricula,
        cnpj,
        mes: competencia?.mes ?? null,
        ano: competencia?.ano ?? null,
        unidadeId: null,
        cargo: null,
        regimeTrabalho,
        isNewCargo: false,
        suggestedCargoName: cargo,
        dataAdmissao,
        matchStatus: match.status as "automatico" | "sugerido" | "revisao",
        matchedProfile: perfilVinculado as any,
        confidence: match.confidence,
        vinculado: false,
        ignorado: false,
      };
    });
  }

  private extractHeaderBlock(text: string): string {
    // Convert to uppercase for case-insensitive matching
    const upperText = text.toUpperCase();
    
    // Financial table markers that indicate the start of the financial section
    const financialMarkers = [
      'SALARIO', 'SALÁRIO', 'REFLEXO', 'HORAS', 'ADICIONAL', 
      'NOTURNO', 'INTER', 'PROVENTOS', 'DESCONTOS', 'INSS', 
      'FGTS', 'LIQUIDO', 'LÍQUIDO', 'TOTAL', 'REFERENCIA', 'REFERÊNCIA'
    ];
    
    // Find the first financial marker
    let cutIndex = -1;
    for (const marker of financialMarkers) {
      const index = upperText.indexOf(marker);
      if (index !== -1 && (cutIndex === -1 || index < cutIndex)) {
        cutIndex = index;
      }
    }
    
    // If no financial markers found, return the first 500 characters as fallback
    if (cutIndex === -1) {
      return text.substring(0, Math.min(500, text.length));
    }
    
    // Return text before the first financial marker
    return text.substring(0, cutIndex).trim();
  }

  private extractNome(text: string): string | null {
    // First try to find name near CPF or matricula
    const cpf = extractCPF(text);
    if (cpf) {
      const cpfIndex = text.indexOf(cpf);
      if (cpfIndex > 0) {
        // Look for a name pattern before CPF
        const beforeCpf = text.substring(0, cpfIndex);
        const nameMatch = beforeCpf.match(/[A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]{10,}/);
        if (nameMatch) {
          const candidate = nameMatch[0].trim();
          if (!this.isInvalidHeaderTerm(candidate)) {
            return candidate;
          }
        }
      }
    }
    
    // Try to find a name pattern in the text
    const namePatterns = [
      /([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]{10,})\s+(?:CPF|Matrícula|Código)/i,
      /(?:NOME|EMPREGADO|COLABORADOR)\s*[:\s]*([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]{10,})/i,
      /([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]{10,})\s+(?:SALÁRIO|REFLEXO|HORAS|ADICIONAL)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        const candidate = match[1].trim();
        if (!this.isInvalidHeaderTerm(candidate) && candidate.length > 5) {
          return candidate;
        }
      }
    }
    
    // Fallback: look for the first long uppercase word that's not a financial term
    const words = text.split(/\s+/);
    for (let i = 0; i < Math.min(20, words.length); i++) {
      const word = words[i];
      if (word.length >= 10 && !this.isInvalidHeaderTerm(word) && 
          !/^(SALARIO|SALÁRIO|REFLEXO|HORAS|ADICIONAL|NOTURNO|INTER|PROVENTOS|DESCONTOS|INSS|FGTS|LIQUIDO|LÍQUIDO|TOTAL|REFERENCIA|REFERÊNCIA)$/i.test(word)) {
        return word;
      }
    }
    
    return null;
  }

  private extractMatricula(text: string): string | null {
    // Try to find explicit matricula patterns
    const matriculaPatterns = [
      /(?:Matr[ií]cula|Matricula|C[oó]digo|Cód)\s*[:\s]*(\d{1,6})/i,
      /(?:C[oó]digo|Código)\s*[:\s]*(\d{1,6})/i,
      /\b(\d{1,6})\b\s+(?:[A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]{10,})/i
    ];
    
    for (const pattern of matriculaPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
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

  private extractCompetencia(text: string): { mes: number; ano: number } | null {
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

    return null;
  }

  private extractCargo(text: string): string | null {
    const patterns = [
      /(?:Cargo|Fun[çc][ãa]o)\s*[:]?\s*([A-Za-zÀ-ÿÇç\s\./-]+)/i,
      /(?:Descri[çc][ãa]o)\s*[:]?\s*([A-Za-zÀ-ÿÇç\s\./-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let cargo = match[1].trim();
        cargo = cargo.split(/(?:\s{2,}|CBO|Data|Dep|Unidade|\n|$)/i)[0].trim();
        if (cargo.length > 3) return cargo;
      }
    }

    return null;
  }

  private extractDataAdmissao(
    text: string,
    periodo: { mes: number; ano: number } | null
  ): string | null {
    const patterns = [
      /(?:Admiss[ãa]o|Adm)[:\s]*(\d{2})\/(\d{2})\/(\d{4})/i,
      /(?:Data\s+Ingresso\s*[:]\s*(\d{2})\/(\d{2})\/(\d{4}))/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    }
    return null;
  }

  private isInvalidHeaderTerm(term: string): boolean {
    const INVALID_HEADER_TERMS = [
      "SALARIO", "SALÁRIO", "EMPREGADO", "REFLEXO", "HORAS", "ADICIONAL", 
      "NOTURNO", "INTER", "PROVENTOS", "DESCONTOS", "INSS", "FGTS", 
      "LIQUIDO", "LÍQUIDO", "TOTAL", "REFERENCIA", "REFERÊNCIA"
    ];
    
    const upperTerm = term.toUpperCase();
    return INVALID_HEADER_TERMS.some(invalid => upperTerm.includes(invalid));
  }
}