import { supabase } from "@/integrations/supabase/client";

export type DocumentType = "contracheque" | "folha_ponto" | "atestado" | "registro_disciplinar";

export interface Profile {
  id: string;
  nome: string;
}

export function getFileKind(file: File): "pdf" | "image" | null {
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

export function formatAtestadoStatus(status: string): string {
  if (status === "aprovado") return "Aprovado";
  if (status === "rejeitado") return "Rejeitado";
  return "Pendente";
}

export function formatDisciplinarTipo(tipo: string): string {
  return tipo === "suspensao" ? "Suspensão" : "Advertência";
}

export function statusClass(status: string): string {
  if (status === "aprovado" || status === "vinculado") return "bg-green-100 text-green-700 border-green-200";
  if (status === "rejeitado") return "bg-red-100 text-red-700 border-red-200";
  return "bg-orange-100 text-orange-700 border-orange-200";
}

export function newDocumentId(): string {
  return crypto.randomUUID();
}

export function atestadoStoragePath(colaboradorId: string, data: string, id: string, file: File): string {
  const ext = file.name.split(".").pop() || "pdf";
  return `documentos/atestados/${colaboradorId}/${data}/${id}.${ext}`;
}

export function disciplinarStoragePath(colaboradorId: string, data: string, tipo: string, id: string, file: File): string {
  const ext = file.name.split(".").pop() || "pdf";
  return `documentos/registros/${colaboradorId}/${tipo}/${data}/${id}.${ext}`;
}