-- 1. Adicionar a coluna 'matricula' à tabela profiles (para resolver o erro 400 na consulta)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS matricula TEXT NULL;

-- Cria um índice para buscas rápidas por matrícula (usado na importação de documentos)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_matricula_idx ON public.profiles (matricula)
WHERE matricula IS NOT NULL;

-- 2. Criar a tabela suggested_profiles (para resolver o erro 404)
CREATE TABLE IF NOT EXISTS public.suggested_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_id uuid NOT NULL,
    extracted_data jsonb NOT NULL,
    status public.suggestion_status DEFAULT 'pending'::public.suggestion_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT suggested_profiles_pkey PRIMARY KEY (id),
    CONSTRAINT suggested_profiles_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documentos(id) ON DELETE CASCADE
);

-- Habilitar RLS (Obrigatório)
ALTER TABLE public.suggested_profiles ENABLE ROW LEVEL SECURITY;

-- Grants (Apenas administradores devem gerenciar sugestões)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.suggested_profiles TO service_role;
GRANT SELECT, UPDATE ON TABLE public.suggested_profiles TO authenticated;

-- Policies (Apenas administradores podem ver/manipular)
-- Assumindo que a função is_admin() existe e funciona corretamente.
CREATE POLICY "Admin Full Access on suggested_profiles" ON public.suggested_profiles
FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());