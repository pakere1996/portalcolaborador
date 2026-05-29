-- 1. Correção para solicitacoes_especiais: Remove a política ampla e substitui por granulares
-- Isso impede que usuários comuns usem o comando UPDATE para alterar o status para 'aprovada'
DROP POLICY IF EXISTS "Usuários gerenciam suas solicitações" ON public.solicitacoes_especiais;

-- Usuários podem visualizar suas próprias solicitações
CREATE POLICY "solicitacoes_select_own" ON public.solicitacoes_especiais
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Usuários podem criar solicitações, mas apenas para si mesmos e obrigatoriamente como 'pendente'
CREATE POLICY "solicitacoes_insert_own" ON public.solicitacoes_especiais
FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND 
  status = 'pendente'
);

-- Usuários podem excluir suas próprias solicitações, desde que ainda estejam pendentes
CREATE POLICY "solicitacoes_delete_own" ON public.solicitacoes_especiais
FOR DELETE TO authenticated USING (
  auth.uid() = user_id AND 
  status = 'pendente'
);

-- 2. Correção para profiles: Impede que usuários aprovem o próprio cadastro
-- Criamos um trigger para proteger campos sensíveis de alterações por não-admins
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o usuário não for admin, impede a alteração de campos críticos
  IF NOT public.is_admin() THEN
    IF (NEW.aprovacao_status IS DISTINCT FROM OLD.aprovacao_status) OR
       (NEW.cpf IS DISTINCT FROM OLD.cpf) OR
       (NEW.id IS DISTINCT FROM OLD.id) OR
       (NEW.data_admissao IS DISTINCT FROM OLD.data_admissao) OR
       (NEW.folga_fixa_semana IS DISTINCT FROM OLD.folga_fixa_semana) THEN
      RAISE EXCEPTION 'Você não tem permissão para modificar campos sensíveis do perfil.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- 3. Correção para trocas_folga: Impede aprovação direta via API/RLS
-- A aprovação deve ocorrer apenas via Edge Function (que usa service_role)
DROP POLICY IF EXISTS "Atualizar trocas" ON public.trocas_folga;

-- Usuários podem apenas cancelar suas próprias trocas pendentes
CREATE POLICY "trocas_cancel_own" ON public.trocas_folga
FOR UPDATE TO authenticated 
USING (auth.uid() = solicitante_id AND status = 'pendente')
WITH CHECK (status = 'cancelada');

-- Nota: Administradores continuam com acesso total via política "Admin Full Access"