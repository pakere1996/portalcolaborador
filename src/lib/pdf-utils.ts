import * as pdfjs from 'pdfjs-dist';

// Configuração do Worker utilizando o recurso de URL do Vite para carregar o arquivo localmente
// @ts-ignore - O sufixo ?url é uma funcionalidade do Vite
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface PageText {
  pageNumber: number;
  text: string;
}

/**
 * Extrai o conteúdo textual de todas as páginas de um arquivo PDF.
 */
export async function extractTextFromPDF(file: File): Promise<PageText[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const results: PageText[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Une os fragmentos de texto da página em uma única string
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .trim();
    
    results.push({
      pageNumber: i,
      text: text
    });
  }

  return results;
}

/**
 * Renderiza uma página específica do PDF como imagem (data URL), para preview visual.
 */
export async function renderPdfPageAsImage(file: File, pageNumber: number): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const scale = 1.5;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Não foi possível criar o contexto do canvas.");

  await page.render({ canvasContext: context, viewport }).promise;

  return canvas.toDataURL("image/png");
}