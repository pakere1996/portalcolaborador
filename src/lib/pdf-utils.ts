import * as pdfjsLib from "pdfjs-dist";

// Configurar worker (opcional, mas recomendado para ambiente browser)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

/**
 * Extrai o texto de todas as páginas de um arquivo PDF
 */
export const extractTextFromPDF = async (file: File): Promise<{ pageNumber: number; text: string }[]> => {
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
};

/**
 * Renderiza uma página do PDF como imagem (base64) para preview
 */
export const renderPdfPageAsImage = async (file: File, pageNumber: number): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context not available');
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  // 🔥 CORREÇÃO: usar 'canvas' em vez de 'canvasContext'
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvas: canvas, // <-- ESSENCIAL
  };
  
  await page.render(renderContext).promise;
  return canvas.toDataURL('image/png');
};