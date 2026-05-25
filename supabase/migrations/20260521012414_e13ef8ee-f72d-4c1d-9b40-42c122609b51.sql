
-- ============ Entrega 3: campos no profile ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS folga_fixa_semana smallint CHECK (folga_fixa_semana BETWEEN 0 AND 6);

-- ============ Entrega 3: limite configurável por dia ============
CREATE TABLE IF NOT EXISTS public.dia_config (
  data date PRIMARY KEY,
  limite_colaboradores int NOT NULL DEFAULT 1 CHECK (limite_colaboradores >= 1),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dia_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dia_config_read" ON public.dia_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "dia_config_admin_all" ON public.dia_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER dia_config_updated_at BEFORE UPDATE ON public.dia_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Remove unique antigo e permite múltiplas folgas no mesmo dia
ALTER TABLE public.folgas DROP CONSTRAINT IF EXISTS folgas_data_key;
-- Cada usuário só pode ter UMA folga por data
CREATE UNIQUE INDEX IF NOT EXISTS folgas_user_data_uq ON public.folgas(user_id, data);
CREATE INDEX IF NOT EXISTS folgas_data_idx ON public.folgas(data);

-- ============ Entrega 4: prioridade de aniversário ============
CREATE TABLE IF NOT EXISTS public.prioridade_aniversario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','abdicada','usada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, data)
);

ALTER TABLE public.prioridade_aniversario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prio_read" ON public.prioridade_aniversario FOR SELECT TO authenticated USING (true);
CREATE POLICY "prio_self_update" ON public.prioridade_aniversario FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "prio_admin_all" ON public.prioridade_aniversario FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prio_aniv_updated_at BEFORE UPDATE ON public.prioridade_aniversario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Gera prioridades de aniversário para um mês
CREATE OR REPLACE FUNCTION public.gerar_prioridades_aniversario(_ano int, _mes int)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _start date := make_date(_ano, _mes, 1);
  _end date := (make_date(_ano, _mes, 1) + interval '1 month - 1 day')::date;
  _p record;
  _aniv date;
  _count int := 0;
BEGIN
  FOR _p IN
    SELECT id, data_nascimento FROM public.profiles
    WHERE ativo = true AND aprovacao_status = 'aprovado' AND data_nascimento IS NOT NULL
  LOOP
    _aniv := make_date(_ano, EXTRACT(month FROM _p.data_nascimento)::int, EXTRACT(day FROM _p.data_nascimento)::int);
    IF _aniv >= _start AND _aniv <= _end AND EXTRACT(dow FROM _aniv) IN (0,6) THEN
      INSERT INTO public.prioridade_aniversario (user_id, data, status)
      VALUES (_p.id, _aniv, 'ativa')
      ON CONFLICT (user_id, data) DO NOTHING;
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END $$;

-- ============ Entrega 3+4: trigger de validação ao inserir folga ============
CREATE OR REPLACE FUNCTION public.validar_folga_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _limite int;
  _ocupadas int;
  _prio record;
BEGIN
  -- limite do dia (padrão 1)
  SELECT limite_colaboradores INTO _limite FROM public.dia_config WHERE data = NEW.data;
  _limite := COALESCE(_limite, 1);

  -- conta folgas já existentes nesse dia (exclui a própria em updates)
  SELECT COUNT(*) INTO _ocupadas FROM public.folgas
   WHERE data = NEW.data AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF _ocupadas >= _limite THEN
    RAISE EXCEPTION 'Limite de colaboradores para % atingido (% / %)', NEW.data, _ocupadas, _limite
      USING ERRCODE = '23505';
  END IF;

  -- prioridade de aniversário: se existe prio ATIVA de outro user nesse dia, bloqueia
  SELECT * INTO _prio FROM public.prioridade_aniversario
   WHERE data = NEW.data AND status = 'ativa' AND user_id <> NEW.user_id
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Data % reservada para aniversariante', NEW.data
      USING ERRCODE = '23505';
  END IF;

  -- se quem está pegando é o próprio aniversariante, marca prio como usada
  UPDATE public.prioridade_aniversario SET status = 'usada'
    WHERE user_id = NEW.user_id AND data = NEW.data AND status = 'ativa';

  -- se o user pegou OUTRA data e tinha prio ativa em algum dia desse mês, libera
  UPDATE public.prioridade_aniversario SET status = 'abdicada'
    WHERE user_id = NEW.user_id
      AND status = 'ativa'
      AND to_char(data, 'YYYY-MM') = NEW.mes
      AND data <> NEW.data;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validar_folga_before_insert ON public.folgas;
CREATE TRIGGER validar_folga_before_insert
  BEFORE INSERT ON public.folgas
  FOR EACH ROW EXECUTE FUNCTION public.validar_folga_insert();

-- ============ Entrega 5: trocas de folga semanal ============
CREATE TYPE public.troca_status AS ENUM ('pendente','aprovada','recusada','cancelada');

CREATE TABLE IF NOT EXISTS public.trocas_folga (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dia_original smallint NOT NULL CHECK (dia_original BETWEEN 0 AND 6),
  dia_solicitado smallint NOT NULL CHECK (dia_solicitado BETWEEN 0 AND 6),
  solicitante_aprovou boolean NOT NULL DEFAULT true,
  destinatario_aprovou boolean NOT NULL DEFAULT false,
  status public.troca_status NOT NULL DEFAULT 'pendente',
  mensagem text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trocas_folga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trocas_self_read" ON public.trocas_folga FOR SELECT TO authenticated
  USING (auth.uid() = solicitante_id OR auth.uid() = destinatario_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "trocas_self_insert" ON public.trocas_folga FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = solicitante_id);
CREATE POLICY "trocas_parties_update" ON public.trocas_folga FOR UPDATE TO authenticated
  USING (auth.uid() = solicitante_id OR auth.uid() = destinatario_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = solicitante_id OR auth.uid() = destinatario_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "trocas_admin_all" ON public.trocas_folga FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trocas_updated_at BEFORE UPDATE ON public.trocas_folga
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ Entrega 5: notificações ============
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  link text,
  payload jsonb,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_user_idx ON public.notificacoes(user_id, lida, created_at DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_self_read" ON public.notificacoes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notif_self_update" ON public.notificacoes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_self_delete" ON public.notificacoes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "notif_admin_all" ON public.notificacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ Trigger: lógica de aprovação dupla e notificações ============
CREATE OR REPLACE FUNCTION public.processar_troca()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sol_nome text;
  _dest_nome text;
  _admin record;
BEGIN
  SELECT nome INTO _sol_nome FROM public.profiles WHERE id = NEW.solicitante_id;
  SELECT nome INTO _dest_nome FROM public.profiles WHERE id = NEW.destinatario_id;

  IF TG_OP = 'INSERT' THEN
    -- notifica destinatário
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (NEW.destinatario_id, 'troca_solicitada',
            'Nova solicitação de troca de folga',
            COALESCE(_sol_nome,'Um colega') || ' quer trocar a folga com você.',
            '/trocas');
    RETURN NEW;
  END IF;

  -- UPDATE: se ambos aprovaram e ainda está pendente → aprovar
  IF NEW.status = 'pendente' AND NEW.solicitante_aprovou AND NEW.destinatario_aprovou THEN
    NEW.status := 'aprovada';
    NEW.respondido_em := now();
    -- aplica troca de folga fixa semanal
    UPDATE public.profiles SET folga_fixa_semana = NEW.dia_solicitado WHERE id = NEW.solicitante_id;
    UPDATE public.profiles SET folga_fixa_semana = NEW.dia_original  WHERE id = NEW.destinatario_id;
    -- notifica os dois
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link) VALUES
      (NEW.solicitante_id,  'troca_aprovada', 'Troca aprovada', 'Sua troca com ' || COALESCE(_dest_nome,'colega') || ' foi aprovada.', '/trocas'),
      (NEW.destinatario_id, 'troca_aprovada', 'Troca aprovada', 'Sua troca com ' || COALESCE(_sol_nome,'colega') || ' foi aprovada.', '/trocas');
    -- notifica todos os admins
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
      VALUES (_admin.user_id, 'troca_aprovada_admin',
              'Troca aprovada entre colaboradores',
              COALESCE(_sol_nome,'?') || ' ↔ ' || COALESCE(_dest_nome,'?'),
              '/admin/trocas');
    END LOOP;
  ELSIF NEW.status = 'recusada' AND OLD.status <> 'recusada' THEN
    NEW.respondido_em := now();
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (NEW.solicitante_id, 'troca_recusada',
            'Troca recusada',
            COALESCE(_dest_nome,'O colega') || ' recusou sua solicitação de troca.',
            '/trocas');
  ELSIF NEW.status = 'cancelada' AND OLD.status <> 'cancelada' THEN
    NEW.respondido_em := now();
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, link)
    VALUES (NEW.destinatario_id, 'troca_cancelada',
            'Troca cancelada',
            COALESCE(_sol_nome,'O solicitante') || ' cancelou a troca.',
            '/trocas');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS processar_troca_insert ON public.trocas_folga;
CREATE TRIGGER processar_troca_insert
  AFTER INSERT ON public.trocas_folga
  FOR EACH ROW EXECUTE FUNCTION public.processar_troca();

DROP TRIGGER IF EXISTS processar_troca_update ON public.trocas_folga;
CREATE TRIGGER processar_troca_update
  BEFORE UPDATE ON public.trocas_folga
  FOR EACH ROW EXECUTE FUNCTION public.processar_troca();

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.folgas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trocas_folga;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
