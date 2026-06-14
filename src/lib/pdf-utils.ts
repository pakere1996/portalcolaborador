import * as pdfjs from 'pdfjs-dist';

// Configuração do Worker do PDF.js
// Utilizamos o CDN para garantir compatibilidade imediata no ambiente do navegador
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

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
      .join(' ');
    
    results.push({
      pageNumber: i,
      text: text.trim()
    });
  }

  return results;
}