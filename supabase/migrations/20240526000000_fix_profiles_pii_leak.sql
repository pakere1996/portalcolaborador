-- 1. Remove the insecure policy that allows everyone to see everything
DROP POLICY IF EXISTS "Perfis são visíveis para todos os autenticados" ON public.profiles;

-- 2. Create a secure policy: users can only see their own full profile
-- Note: Admins already have "Admin Full Access" policy which covers them
CREATE POLICY "profiles_self_select" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

-- 3. Create a public view for non-sensitive data
-- This allows employees to see who their colleagues are without seeing private data
CREATE OR REPLACE VIEW public.colaboradores AS
SELECT 
  id, 
  nome, 
  cargo, 
  ativo, 
  folga_fixa_semana, 
  data_nascimento,
  aprovacao_status,
  created_at
FROM public.profiles;

-- 4. Grant access to the view for all authenticated users
GRANT SELECT ON public.colaboradores TO authenticated;
GRANT SELECT ON public.colaboradores TO service_role;

-- 5. Ensure RLS is still enabled on the base table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;