import * as pdfjsLib from "pdfjs-dist";

// 🔥 Configuração do worker usando CDN com versão compatível
// Usando a versão 4.0.379 (última estável) - pode ajustar conforme necessário
const PDFJS_VERSION = "4.0.379";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

export interface PageText {
  pageNumber: number;
  text: string;
}

/**
 * Extrai texto de todas as páginas de um PDF
 */
export const extractTextFromPDF = async (file: File): Promise<PageText[]> => {
  try {
    console.log("📄 Iniciando extração de texto do PDF:", file.name);
    const arrayBuffer = await file.arrayBuffer();
    console.log("📄 ArrayBuffer carregado, tamanho:", arrayBuffer.byteLength);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log("📄 PDF carregado, número de páginas:", pdf.numPages);
    
    const pages: PageText[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      console.log(`📄 Processando página ${i} de ${pdf.numPages}`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pages.push({ pageNumber: i, text });
      console.log(`📄 Página ${i} extraída, tamanho do texto: ${text.length} caracteres`);
    }
    return pages;
  } catch (error) {
    console.error("❌ Erro ao extrair texto do PDF:", error);
    throw error;
  }
};

/**
 * Renderiza uma página do PDF como imagem (para preview)
 */
export const renderPdfPageAsImage = async (file: File, pageNumber: number): Promise<string> => {
  try {
    console.log(`🖼️ Renderizando página ${pageNumber} como imagem`);
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNumber);
    
    // Calcula o viewport com escala para melhor qualidade
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    if (!context) throw new Error("Canvas context not available");
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Renderiza a página no canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    console.log(`🖼️ Página ${pageNumber} renderizada com sucesso`);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error(`❌ Erro ao renderizar página ${pageNumber}:`, error);
    throw error;
  }
};

/**
 * Versão alternativa para extrair texto com fallback para arquivos grandes
 */
export const extractTextFromPDFWithFallback = async (file: File): Promise<PageText[]> => {
  try {
    return await extractTextFromPDF(file);
  } catch (error) {
    console.warn("⚠️ Falha na extração padrão, tentando com configurações alternativas...", error);
    
    // Fallback: tentar com configuração diferente do worker
    const originalWorkerSrc = pdfjsLib.GlobalWorkerOptions.workerSrc;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    
    try {
      const result = await extractTextFromPDF(file);
      pdfjsLib.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
      return result;
    } catch (fallbackError) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = originalWorkerSrc;
      console.error("❌ Fallback também falhou:", fallbackError);
      throw fallbackError;
    }
  }
};