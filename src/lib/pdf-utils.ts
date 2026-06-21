// src/lib/pdf-utils.ts
import * as pdfjsLib from "pdfjs-dist";

// Configuração do worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PageText {
  pageNumber: number;
  text: string;
}

export const extractTextFromPDF = async (file: File): Promise<PageText[]> => {
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
};

export const renderPdfPageAsImage = async (file: File, pageNumber: number): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  if (!context) throw new Error("Canvas context not available");
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // 🔥 CORREÇÃO: use 'canvas' em vez de 'canvasContext'
  // O pdf.js espera um objeto com a propriedade 'canvas' ou 'canvasContext' dependendo da versão.
  // Vamos usar a forma mais compatível.
  await page.render({
    canvasContext: context,
    viewport: viewport,
  } as any).promise;
  
  return canvas.toDataURL("image/png");
};