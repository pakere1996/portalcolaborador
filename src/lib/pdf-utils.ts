import * as pdfjsLib from "pdfjs-dist";

// Configura o worker com arquivo local
const workerUrl = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

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
    
    // Cria um canvas e obtém o contexto
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context não disponível");
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // 🔥 CORREÇÃO: Usar 'canvas' em vez de 'canvasContext' (API mais recente)
    await page.render({
      canvas: canvas,        // <-- propriedade 'canvas' (não 'canvasContext')
      viewport: viewport,
    }).promise;
    
    const dataUrl = canvas.toDataURL("image/png");
    console.log("✅ Imagem renderizada com sucesso");
    return dataUrl;
  } catch (error) {
    console.error("❌ Erro ao renderizar página do PDF:", error);
    throw new Error(`Falha ao renderizar página do PDF: ${(error as Error).message}`);
  }
};