import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

// Configuração do worker - usando a mesma versão do pacote
const PDFJS_VERSION = pdfjsLib.version;
// Usa o CDN com a versão correta
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export interface PageText {
  pageNumber: number;
  text: string;
}

export const extractTextFromPDF = async (file: File): Promise<PageText[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: PageText[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pages.push({ pageNumber: i, text });
    }
    return pages;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    throw new Error("Falha ao extrair texto do PDF. Verifique o arquivo.");
  }
};

export const renderPdfPageAsImage = async (file: File, pageNumber: number): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    if (!context) throw new Error("Canvas context not available");
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Usa a renderização com canvasContext
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Erro ao renderizar página do PDF:", error);
    throw new Error("Falha ao renderizar página do PDF. Verifique o arquivo.");
  }
};

// Função extra para extrair página usando pdf-lib (já usada no DocumentImportForm)
export const extractPageFromPdf = async (file: File, pageNumber: number): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1]);
  newPdf.addPage(copiedPage);
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
};