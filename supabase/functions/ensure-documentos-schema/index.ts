import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "É necessário estar autenticado." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { error: bucketError } = await supabaseAdmin.storage.createBucket("documentos", {
      public: false,
      fileSizeLimit: 10485760,
    });

    if (bucketError && !String(bucketError.message).toLowerCase().includes("already")) {
      console.warn("[ensure-documentos-schema] Bucket já existe ou não precisava ser criado", bucketError.message);
    }

    const sql = `
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.atestados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_atestado DATE NOT NULL,
  dias_afastamento INTEGER NOT NULL CHECK (dias_afastamento >= 0),
  observacao TEXT,
  observacao_admin TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  storage_path TEXT NOT NULL,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('pdf', 'image')),
  criado_por UUID REFERENCES auth.users(id),
  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.registros_disciplinares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  colaborador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('advertencia', 'suspensao')),
  data DATE NOT NULL,
  observacao TEXT,
  storage_path TEXT NOT NULL,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('pdf', 'image')),
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_disciplinares ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.atestados TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registros_disciplinares TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.atestados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registros_disciplinares TO authenticated;

CREATE INDEX IF NOT EXISTS atestados_user_idx ON public.atestados(user_id);
CREATE INDEX IF NOT EXISTS atestados_colaborador_idx ON public.atestados(colaborador_id);
CREATE INDEX IF NOT EXISTS atestados_status_idx ON public.atestados(status);
CREATE INDEX IF NOT EXISTS registros_disciplinares_colaborador_idx ON public.registros_disciplinares(colaborador_id);
CREATE INDEX IF NOT EXISTS registros_disciplinares_tipo_data_idx ON public.registros_disciplinares(colaborador_id, tipo, data);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atestados_status_check') THEN
    ALTER TABLE public.atestados ADD CONSTRAINT atestados_status_check CHECK (status IN ('pendente', 'aprovado', 'rejeitado'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atestados_colaborador_data_unique') THEN
    ALTER TABLE public.atestados ADD CONSTRAINT atestados_colaborador_data_unique UNIQUE (colaborador_id, data_atestado);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registros_disciplinares_tipo_data_unique') THEN
    ALTER TABLE public.registros_disciplinares ADD CONSTRAINT registros_disciplinares_tipo_data_unique UNIQUE (colaborador_id, tipo, data);
  END IF;
END $$;

DROP POLICY IF EXISTS "atestados_admin_full_access" ON public.atestados;
DROP POLICY IF EXISTS "atestados_owner_select" ON public.atestados;
DROP POLICY IF EXISTS "atestados_owner_insert" ON public.atestados;
DROP POLICY IF EXISTS "atestados_owner_update_pending" ON public.atestados;
DROP POLICY IF EXISTS "atestados_owner_delete_pending" ON public.atestados;

CREATE POLICY "atestados_admin_full_access" ON public.atestados
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "atestados_owner_select" ON public.atestados
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "atestados_owner_insert" ON public.atestados
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND auth.uid() = colaborador_id AND status = 'pendente');

CREATE POLICY "atestados_owner_update_pending" ON public.atestados
FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'pendente')
WITH CHECK (auth.uid() = user_id AND status = 'pendente');

CREATE POLICY "atestados_owner_delete_pending" ON public.atestados
FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status = 'pendente');

DROP POLICY IF EXISTS "registros_disciplinares_admin_full_access" ON public.registros_disciplinares;

CREATE POLICY "registros_disciplinares_admin_full_access" ON public.registros_disciplinares
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
`;

    const { error: sqlError } = await supabaseAdmin.rpc("exec_sql", { sql });
    if (sqlError) {
      if (String(sqlError.message).includes("function exec_sql")) {
        throw new Error("A função exec_sql ainda não está disponível neste projeto Supabase.");
      }
      throw sqlError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ensure-documentos-schema] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});