import { supabase } from "@/integrations/supabase/client";

let schemaPromise: Promise<void> | null = null;

export function ensureDocumentosSchema() {
  if (!schemaPromise) {
    schemaPromise = supabase.functions.invoke("ensure-documentos-schema").then(({ data, error }) => {
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    }).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}