import type { DocumentParser, PageResult, ProfileForMatching } from "./document-parsers";
import type { PageText } from "../pdf-utils";
import { findBestProfileMatch } from "../documentos-matching";

const INVALID_HEADER_TERMS = [
  "SALARIO","SALÁRIO","EMPREGADO","REFLEXO","HORAS","ADICIONAL","NOTURNO","INTER","REFERENCIA","REFERÊNCIA","PROVENTOS","DESCONTOS","INSS","FGTS","BASE","LIQUIDO","LÍQUIDO","TOTAL","CONTRACHEQUE","HOLERITE","RECIBO","PAGAMENTO","EMPRESA","LTDA"
];

function collapseSpaces(v:string):string{return v.replace(/\u00a0/g," ").replace(/\s+/g," ").trim();}
function normalizeForCompare(v:string):string{return collapseSpaces(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();}
function rejectInvalid(v:string|undefined|null):string|undefined|null{const cleaned=collapseSpaces(v??"");if(!cleaned)return null;const norm=normalizeForCompare(cleaned);if(INVALID_HEADER_TERMS.some(t=>norm.includes(normalizeForCompare(t))))return null;return cleaned;}

function firstLineMatch(txt:string,re:RegExp):string|undefined{return re.exec(txt)?.[1]?.trim();}

export class ContrachequeParser implements DocumentParser{
  parse(pages:PageText[],profiles:ProfileForMatching[]):PageResult[]{
    return pages.map(p=>{
      const header=this.extractHeaderBlock(p.text);
      const nome=this.extractNomeFromHeader(header);
      const matricula=this.extractMatriculaFromHeader(header);
      const cpf=this.extractCpfFromHeader(header);
      const cnpj=this.extractCnpjFromHeader(header);
      const competencia=this.extractCompetenciaFromHeader(header);
      const match=findBestProfileMatch(nome,cpf,profiles as any,matricula);
      return{
        pageNumber:p.pageNumber,
        text:p.text,
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
  private extractHeaderBlock(txt:string):string{
    const upper=txt.toUpperCase();
    const idx=FINANCIAL_SECTION_MARKERS.map(m=>upper.indexOf(m)).filter(i=>i>=0).sort((a,b)=>a-b)[0]??-1;
    return idx===-1?collapseSpaces(txt.slice(0,Math.min(700,txt.length))):collapseSpaces(txt.slice(0,idx));
  }
  private extractNomeFromHeader(h:string):string|undefined{
    const cpf=this.extractCpfFromHeader(h);
    if(cpf){
      const before=h.slice(0,h.indexOf(cpf));
      const labelMatch=before.match(/(?:Nome|Empregado|Colaborador|Funcion[aá]rio)\s*[:\-]?\s*([^\r\n]{3,})/i);
      let cand=labelMatch?.[1]??null;
      if(!cand){
        const lines=before.split(/\r?\n/).map(collapseSpaces).filter(Boolean);
        cand=lines[lines.length-1]??null;
      }
      cand=cand?.split(/(?:CPF|Matr[ií]cula|C[oó]digo|Cargo|Unidade|CNPJ|Compet[eê]ncia|Refer[eê]ncia)/i)[0]??null;
      const name=rejectInvalid(cand);
      if(name)return name;
    }
    const lineName=firstLineMatch(h,/^[A-Za-zÀ-ÖØ-öø-ÿÇç\s.\-]{3,}$/);
    return rejectInvalid(lineName);
  }
  private extractMatriculaFromHeader(h:string):string|undefined{
    const pats=[/(?:Matr[ií]cula|Matricula|C[oó]digo|Codigo)\s*[:\-]?\s*(\d{1,8})/i,/\b(\d{1,8})\b\s+[A-Za-zÀ-ÖØ-öø-ÿÇç]/i];
    for(const p of pats){const m=p.exec(h);if(m?.[1])return m[1];}
    return undefined;
  }
  private extractCpfFromHeader(h:string):string|undefined{
    const fmt=h.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
    if(fmt)return fmt[0];
    const d=h.match(/\b\d{11}\b/);
    if(!d)return undefined;
    const cpf=d[0];
    return `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`;
  }
  private extractCnpjFromHeader(h:string):string|undefined{return h.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/)?.[0];}
  private extractCargoFromHeader(h:string):string|undefined{
    const m=h.match(/(?:Cargo|Fun[çc][ãa]o|Cargo\/Fun[çc][ãa]o)\s*[:\-]?\s*([^\r\n]{2,})/i);
    const cand=m?.[1]?.split(/(?:Proventos|Descontos|INSS|FGTS|Sal[aá]rio|Base|Refer[eê]ncia|Compet[eê]ncia|Periodo|Per[ií]odo)/i)[0]??undefined;
    return rejectInvalid(cand);
  }
  private extractCompetenciaFromHeader(h:string):{mes:number;ano:number}|undefined{
    const txt=normalizeForCompare(h);
    const monthMatch=txt.match(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b\s+(?:de\s+)?(\d{4})/i);
    if(monthMatch?.[1]&&monthMatch?.[2]){return {mes:MONTHS[monthMatch[1]],ano:Number(monthMatch[2])};}
    const pats=[/competencia\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,/referencia\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,/periodo\s*[:\-]?\s*(\d{1,2})\s*\/\s*(\d{4})/i,/\b(\d{1,2})\s*\/\s*(\d{4})\b/i];
    for(const p of pats){const m=p.exec(txt);if(m?.[1]&&m?.[2]){return {mes:Number(m[1]),ano:Number(m[2])};}}
    return undefined;
  }
}