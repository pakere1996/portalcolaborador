import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { findBestProfileMatch } from "../documentos-matching";

const INVALID_HEADER_TERMS = [
  "SALARIO","SALÁRIO","EMPREGADO","REFLEXO","HORAS","ADICIONAL","NOTURNO","INTER","REFERENCIA","REFERÊNCIA","PROVENTOS","DESCONTOS","INSS","FGTS","BASE","LIQUIDO","LÍQUIDO","TOTAL","CONTRACHEQUE","HOLERITE","RECIBO","PAGAMENTO","EMPRESA","LTDA"
];

// Markers that indicate the start of the financial section (events/rubricas table)
const FINANCIAL_SECTION_MARKERS = [
  "SALARIO", "SALÁRIO", "HORAS", "ADICIONAL", "NOTURNO", "INTERVALO", "REFERENCIA", "REFERÊNCIA",
  "PROVENTOS", "DESCONTOS", "INSS", "FGTS", "BASE", "LIQUIDO", "LÍQUIDO", "TOTAL"
];

function collapseSpaces(v:string):string{return v.replace(/\u00a0/g," ").replace(/\s+/g," ").trim();}
function normalizeForCompare(v:string):string{return collapseSpaces(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();}
function rejectInvalid(v:string|undefined|null):string|undefined|null{
  const cleaned=collapseSpaces(v??"");
  if(!cleaned)return null;
  const norm=normalizeForCompare(cleaned);
  if(INVALID_HEADER_TERMS.some(t=>norm.includes(normalizeForCompare(t))))return null;
  return cleaned;
}

function firstLineMatch(txt:string,re:RegExp):string|undefined{return re.exec(txt)?.[1]?.trim();}

export class ContrachequeParser implements DocumentParser{
  parse(pages:PageText[],profiles:ProfileForMatching[]):PageResult[]{
    return pages.map(p=>{
      // Extract the header block (everything before the first financial section marker)
      const header = this.extractHeaderBlock(p.text);
      
      // Extract fields from the header block only
      const nome = this.extractNomeFromHeader(header);
      const matricula = this.extractMatriculaFromHeader(header);
      const cpf = this.extractCpfFromHeader(header);
      const cnpj = this.extractCnpjFromHeader(header);
      const competencia = this.extractCompetenciaFromHeader(header);
      
      // Use the header block for matching (we pass the header as the text for matching? 
      // But note: the matching function expects the raw text? Actually, we are passing the header as the text for the page? 
      // However, the matching function uses the nome, cpf, and matricula we extracted. 
      // We are not changing the matching function call, just the inputs to it.
      const match = findBestProfileMatch(nome, cpf, profiles as any, matricula);
      
      return {
        pageNumber:p.pageNumber,
        text:p.text, // Keep the original text for debugging
        nome,
        cpf,
        matricula,
        cnpj,
        mes:competencia?.mes??null,
        ano:competencia?.ano??null,
        unidadeId:null,
        cargo:null,
        regimeTrabalho:null,
        isNewCargo:false,
        suggestedCargoName:null,
        dataAdmissao:null,
        matchStatus:match.status as "automatico"|"sugerido"|"revisao",
        matchedProfile:match.profile as any,
        confidence:match.confidence,
        vinculado:false,
        ignorado:false      };
    });
  }
  
  // Extract the header block: everything before the first occurrence of any financial section marker
  private extractHeaderBlock(txt:string):string{
    const upper = txt.toUpperCase();
    // Find the earliest position of any financial section marker
    let earliestPos = upper.length;
    for (const marker of FINANCIAL_SECTION_MARKERS) {
      const pos = upper.indexOf(marker);
      if (pos !== -1 && pos < earliestPos) {
        earliestPos = pos;
      }
    }
    // If we found a marker, take the substring before it; otherwise, take the whole text (but limit to avoid huge blocks)
    if (earliestPos < upper.length) {
      return collapseSpaces(txt.slice(0, earliestPos));
    }
    // Fallback: take first 700 characters to avoid processing the entire financial table
    return collapseSpaces(txt.slice(0, Math.min(700, txt.length)));
  }
  
  private extractNomeFromHeader(h:string):string|undefined{
    const cpf = this.extractCpfFromHeader(h);
    if(cpf){
      const before = h.slice(0, h.indexOf(cpf));
      const labelMatch = before.match(/(?:Nome|Empregado|Colaborador|Funcion[aá]rio)\s*[:\-]?\s*([^\r\n]{3,})/i);
      let cand = labelMatch?.[1] ?? null;
      if(!cand){
        const lines = before.split(/\r?\n/).map(collapseSpaces).filter(Boolean);
        cand = lines[lines.length-1] ?? null;
      }
      cand = cand?.split(/(?:CPF|Matr[ií]cula|C[oó]digo|Cargo|Unidade|CNPJ|Compet[eê]ncia|Refer[eê]ncia)/i)[0] ?? null;
      const name = rejectInvalid(cand);
      if(name) return name;
    }
    const lineName = firstLineMatch(h, /^[A-Za-zÀ-ÖØ-öø-ÿÇç\s.\-]{3,}$/);
    return rejectInvalid(lineName);
  }
  
  private extractMatriculaFromHeader(h:string):string|undefined{
    const pats = [
      /(?:Matr[ií]cula|Matricula|C[oó]digo|Codigo)\s*[:\-]?\s*(\d{1,8})/i,
      /\b(\d{1,8})\b\s+[A-Za-zÀ-ÖØ-öø-ÿÇç]/i
    ];
    for(const p of pats){
      const m = p.exec(h);
      if(m?.[1]) return m[1];
    }
    return undefined;
  }
  
  private extractCpfFromHeader(h:string):string|undefined{
    const fmt = h.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if(fmt) return fmt[0];
    const d = h.match(/\b\d{11}\b/);
    if(!d) return undefined;
    const cpf = d[0];
    return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
  }
  
  private extractCnpjFromHeader(h:string):string|undefined{
    return h.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0];
  }
  
  private extractCargoFromHeader(h:string):string|undefined{
    const m = h.match(/(?:Cargo|Fun[çc][ãa]o|Cargo\/Fun[çc][ãa]o)\s*[:\-]?\s*([^\r\n]{2,})/i);
    const cand = m?.[1]?.split(/(?:Proventos|Descontos|INSS|FGTS|Sal[aá]rio|Base|Refer[eê]ncia|Compet[eê]ncia|Periodo|Per[ií]odo)/i)[0] ?? undefined;
    return rejectInvalid(cand);
  }
  
  private extractCompetenciaFromHeader(h:string):{mes:number;ano:number}|undefined{
    const txt = normalizeForCompare(h);
    // Try month name format
    const monthMatch = txt.match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b\s+(?:de\s+)?(\d{4})/i);
    if(monthMatch?.[1] && monthMatch?.[2]){
      return {mes:MONTHS[monthMatch[1]], ano:Number(monthMatch[2])};
    }
    // Try numeric formats
    const pats = [
      /competencia\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,
      /referencia\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,
      /periodo\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,
      /\b(\d{1,2})\s*\/\s*(\d{4})\b/i
    ];
    for(const p of pats){
      const m = p.exec(txt);
      if(m?.[1] && m?.[2]){
        return {mes:Number(m[1]), ano:Number(m[2])};
      }
    }
    return undefined;
  }
}

// Month names mapping (Portuguese)
const MONTHS: {[key:string]: number} = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
};