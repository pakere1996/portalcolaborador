import * as pdfjsLib from "pdfjs-dist";
// Importa o worker diretamente do pacote
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

// Configuração do worker usando a versão local
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

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
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Erro ao renderizar página do PDF:", error);
    throw new Error("Falha ao renderizar página do PDF.");
  }
};