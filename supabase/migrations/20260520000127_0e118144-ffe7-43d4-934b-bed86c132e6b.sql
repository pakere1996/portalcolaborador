-- 1. Profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_admissao date,
  ADD COLUMN IF NOT EXISTS data_demissao date,
  ADD COLUMN IF NOT EXISTS aprovacao_status text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_aprovacao_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_aprovacao_status_check
  CHECK (aprovacao_status IN ('pendente', 'aprovado', 'recusado'));

-- 2. handle_new_user: pendente por padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _criado_por_admin boolean;
  _is_first boolean;
  _status text;
  _ativo boolean;
BEGIN
  _criado_por_admin := COALESCE((NEW.raw_user_meta_data->>'criado_por_admin')::boolean, false);
  _is_first := NOT EXISTS (SELECT 1 FROM public.profiles);

  IF _criado_por_admin OR _is_first THEN
    _status := 'aprovado';
    _ativo := true;
  ELSE
    _status := 'pendente';
    _ativo := false;
  END IF;

  INSERT INTO public.profiles (id, nome, cpf, cargo, ativo, aprovacao_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Sem nome'),
    COALESCE(NEW.raw_user_meta_data->>'cpf', NEW.id::text),
    COALESCE(NEW.raw_user_meta_data->>'cargo', 'Funcionário'),
    _ativo,
    _status
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'funcionario')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Privacidade: funcionarios só veem própria folga
DROP POLICY IF EXISTS folgas_read_all_authenticated ON public.folgas;
CREATE POLICY folgas_self_or_admin_read ON public.folgas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. Função para listar datas ocupadas sem revelar usuário
CREATE OR REPLACE FUNCTION public.folgas_dates_in_range(_start date, _end date)
RETURNS TABLE(data date)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT f.data FROM public.folgas f WHERE f.data >= _start AND f.data <= _end;
$$;
GRANT EXECUTE ON FUNCTION public.folgas_dates_in_range(date, date) TO authenticated;

-- 5. Aprovar/recusar profile (admin only via RLS já existente)
-- Já temos profiles_admin_update; só precisamos garantir que admin pode listar pendentes (já cobre).

-- 6. Sorteio automático: SECURITY DEFINER que insere folgas para quem não escolheu
CREATE OR REPLACE FUNCTION public.sortear_folgas_mes(_ano int, _mes int)
RETURNS TABLE(user_id uuid, data date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start date := make_date(_ano, _mes, 1);
  _end date := (make_date(_ano, _mes, 1) + interval '1 month - 1 day')::date;
  _mes_key text := to_char(_start, 'YYYY-MM');
  _func record;
  _candidate date;
  _tipo text;
BEGIN
  FOR _func IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.ativo = true
      AND p.aprovacao_status = 'aprovado'
      AND NOT EXISTS (
        SELECT 1 FROM public.folgas f
        WHERE f.user_id = p.id AND f.mes = _mes_key
      )
  LOOP
    -- Pick a random available weekend date (sat=6, sun=0) in the month
    SELECT d INTO _candidate
    FROM generate_series(_start, _end, interval '1 day') AS g(d)
    WHERE EXTRACT(dow FROM g.d) IN (0, 6)
      AND NOT EXISTS (SELECT 1 FROM public.folgas f WHERE f.data = g.d::date)
      AND NOT EXISTS (
        SELECT 1 FROM public.datas_bloqueadas b
        WHERE b.data = g.d::date AND b.liberada = false
      )
    ORDER BY random()
    LIMIT 1;

    IF _candidate IS NOT NULL THEN
      _tipo := CASE EXTRACT(dow FROM _candidate) WHEN 6 THEN 'sabado' ELSE 'domingo' END;
      INSERT INTO public.folgas (user_id, data, mes, tipo, criado_por)
      VALUES (_func.id, _candidate, _mes_key, _tipo, NULL);
      user_id := _func.id;
      data := _candidate;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sortear_folgas_mes(int, int) TO authenticated, service_role;