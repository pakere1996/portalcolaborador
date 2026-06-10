-- Adiciona a coluna 'matricula' à tabela profiles
ALTER TABLE public.profiles
ADD COLUMN matricula TEXT NULL;

-- Cria um índice para buscas rápidas por matrícula (usado na importação de documentos)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_matricula_idx ON public.profiles (matricula)
WHERE matricula IS NOT NULL;

-- Garante que a coluna seja acessível para usuários autenticados (se necessário)
GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;