import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";

// 🔥 SOLUÇÃO DEFINITIVA: Importa o worker como um módulo ES com ?worker
// O Vite vai tratar isso corretamente e servir o worker de forma compatível
import Worker from "pdfjs-dist/build/pdf.worker.mjs?worker";

// 🔥 Configura o worker usando o objeto importado
pdfjsLib.GlobalWorkerOptions.workerSrc = Worker;

export interface PageText {
  pageNumber: number;
  text: string;
}

export const extractTextFromPDF = async (file: File): Promise<PageText[]> => {
  try {
    console.log("🔍 Iniciando extração de texto do PDF:", file.name);

    const arrayBuffer = await file.arrayBuffer();
    console.log("📄 ArrayBuffer carregado, tamanho:", arrayBuffer.byteLength);

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`📚 PDF carregado, ${pdf.numPages} páginas`);

    const pages: PageText[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pages.push({ pageNumber: i, text });
      console.log(`📝 Página ${i} extraída, ${text.length} caracteres`);
    }

    return pages;
  } catch (error) {
    console.error("❌ Erro ao extrair texto do PDF:", error);
    throw new Error(`Falha ao extrair texto do PDF: ${(error as Error).message}`);
  }
};

export const renderPdfPageAsImage = async (file: File, pageNumber: number): Promise<string> => {
  try {
    console.log(`🖼️ Renderizando página ${pageNumber} do PDF:`, file.name);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context não disponível");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    } as any).promise;

    const dataUrl = canvas.toDataURL("image/png");
    console.log("✅ Imagem renderizada com sucesso");
    return dataUrl;
  } catch (error) {
    console.error("❌ Erro ao renderizar página do PDF:", error);
    throw new Error(`Falha ao renderizar página do PDF: ${(error as Error).message}`);
  }
};

export const extractSinglePageAsBlob = async (
  pdfBytes: ArrayBuffer,
  pageNumber: number
): Promise<Blob> => {
  try {
    console.log(`✂️ Extraindo página ${pageNumber} como PDF individual`);

    const sourcePdf = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();

    const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNumber - 1]);
    newPdf.addPage(copiedPage);

    const newPdfBytes = await newPdf.save();
    console.log("✅ Página extraída com sucesso");
    
    const uint8Array = new Uint8Array(newPdfBytes);
    return new Blob([uint8Array], { type: "application/pdf" });
  } catch (error) {
    console.error("❌ Erro ao extrair página individual do PDF:", error);
    throw new Error(`Falha ao extrair página do PDF: ${(error as Error).message}`);
  }
};