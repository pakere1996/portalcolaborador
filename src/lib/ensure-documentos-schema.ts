import { supabase } from "@/integrations/supabase/client";

// Mantendo a tipagem estrita de Promise nativa
let schemaPromise: Promise<void> | null = null;

export function ensureDocumentosSchema(): Promise<void> {
  if (!schemaPromise) {
    // Envolvemos o fluxo em um Promise.resolve nativo para converter a PromiseLike do Supabase
    schemaPromise = Promise.resolve(
      supabase.rpc("exec_sql", {
        sql: `
          CREATE TABLE IF NOT EXISTS public.documentos (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            colaborador_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            tipo TEXT NOT NULL CHECK (tipo IN ('contracheque', 'folha_ponto', 'atestado', 'disciplinar')),
            mes TEXT,
            ano TEXT,
            observacao TEXT,
            storage_path TEXT NOT NULL,
            storage_type TEXT NOT NULL CHECK (storage_type IN ('pdf', 'image')),
            criado_por UUID REFERENCES auth.users(id),
            respondido_por UUID REFERENCES auth.users(id),
            respondido_em TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );

          ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documentos TO service_role;
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documentos TO authenticated;

          CREATE POLICY "documentos_select_policy" ON public.documentos
          FOR SELECT TO authenticated USING (auth.uid() = colaborador_id OR is_admin());

          CREATE POLICY "documentos_insert_policy" ON public.documentos
          FOR INSERT TO authenticated WITH CHECK (auth.uid() = colaborador_id);

          CREATE POLICY "documentos_update_policy" ON public.documentos        
          FOR UPDATE TO authenticated USING (auth.uid() = colaborador_id);

          CREATE POLICY "documentos_delete_policy" ON public.documentos
          FOR DELETE TO authenticated USING (auth.uid() = colaborador_id);
        `
      }).then(({ data, error }) => {
        if (error) throw error;
        // Tratamento para o caso do retorno do rpc conter um campo de erro customizado
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          throw new Error(String(data.error));
        }
      })
    );
  }

  return schemaPromise;
}