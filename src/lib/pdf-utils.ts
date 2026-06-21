import * as pdfjsLib from "pdfjs-dist";

// Configuração do worker para o PDF.js
const PDFJS_VERSION = (pdfjsLib as any).version || "3.11.174";
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

/**
 * Extrai o texto de todas as páginas de um arquivo PDF
 */
export const extractTextFromPDF = async (file: File): Promise<{ pageNumber: number; text: string }[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pages.push({ pageNumber: i, text });
    }

    return pages;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    throw error;
  }
};

/**
 * Renderiza uma página específica de um PDF como imagem (data URL)
 */
export const renderPdfPageAsImage = async (file: File, pageNumber: number): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);
    
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    // Cria o canvas com as dimensões adequadas
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    if (!context) {
      throw new Error("Canvas context not available");
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // 🔥 Renderiza a página no canvas (corrigindo o erro de tipo)
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Erro ao renderizar página do PDF:", error);
    throw error;
  }
};

/**
 * Verifica se um arquivo é um PDF válido
 */
export const isPDF = (file: File): boolean => {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
};

/**
 * Obtém o número de páginas de um arquivo PDF
 */
export const getPDFPageCount = async (file: File): Promise<number> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.error("Erro ao obter número de páginas do PDF:", error);
    throw error;
  }
};