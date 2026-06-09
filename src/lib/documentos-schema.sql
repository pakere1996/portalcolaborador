-- Criar bucket de documentos
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', false, false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  avif_autodetection = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

-- Criar tabela de documentos
CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('contracheque', 'folha_ponto')),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('vinculado', 'pendente')),
  nome_pdf TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
-- Admin pode acessar tudo
CREATE POLICY "Admin full access" ON public.documentos
  FOR ALL TO authenticated
  USING (is_admin());

-- Colaborador só acessa seus próprios documentos
CREATE POLICY "Users can access own documents" ON public.documentos
  FOR SELECT TO authenticated
  USING (auth.uid() = colaborador_id);

-- Admin pode inserir documentos
CREATE POLICY "Admin can insert documents" ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Admin pode atualizar documentos
CREATE POLICY "Admin can update documents" ON public.documentos
  FOR UPDATE TO authenticated
  USING (is_admin());

-- Admin pode deletar documentos
CREATE POLICY "Admin can delete documents" ON public.documentos
  FOR DELETE TO authenticated
  USING (is_admin());

-- Políticas de storage para bucket documentos
-- Admin pode fazer upload
CREATE POLICY "Admin can upload documentos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND is_admin());

-- Admin pode acessar todos os objetos
CREATE POLICY "Admin can access all documentos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND is_admin());

-- Colaborador pode acessar seus próprios documentos
CREATE POLICY "Users can access own documentos storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND auth.uid() = (storage.foldername::text::uuid));

-- Colaborador pode acessar documentos pendentes (apenas leitura)
CREATE POLICY "Users can access pending documentos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND storage.foldername::text LIKE 'pendentes/%');