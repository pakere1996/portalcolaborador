// Adicione a função de extração no início do arquivo, após os imports
import { PDFDocument } from "pdf-lib";

// ... dentro do componente, antes de handleAprovarTudo
const extractPageFromPdf = async (file: File, pageNumber: number): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1]);
  newPdf.addPage(copiedPage);
  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
};

// No handleAprovarTudo, substitua o upload do arquivo completo por:
const pagePdfBlob = await extractPageFromPdf(selectedFile!, result.pageNumber);
const { error: uploadError } = await supabase.storage.from("documentos")
  .upload(storagePath, pagePdfBlob, { contentType: "application/pdf", upsert: true });