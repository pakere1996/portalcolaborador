-- 1. Remove the leaky policy that allows anyone to see all profiles
DROP POLICY IF EXISTS "Perfis são visíveis para todos os autenticados" ON public.profiles;

-- 2. Create a secure policy for the profiles table
-- Users can see their own profile, and admins can see all profiles.
CREATE POLICY "profiles_select_secure" ON public.profiles
FOR SELECT TO authenticated 
USING (auth.uid() = id OR is_admin());

-- 3. Create a safe view for general use (colaboradores)
-- This view excludes sensitive PII like CPF, address, and contact info.
-- We use security_invoker = false (default) so the view owner's permissions are used,
-- allowing us to expose specific columns to all authenticated users safely.
CREATE OR REPLACE VIEW public.colaboradores AS
SELECT 
  id, 
  nome, 
  cargo, 
  folga_fixa_semana, 
  ativo, 
  data_nascimento,
  aprovacao_status
FROM public.profiles;

-- 4. Grant access to the view for authenticated users
GRANT SELECT ON public.colaboradores TO authenticated;