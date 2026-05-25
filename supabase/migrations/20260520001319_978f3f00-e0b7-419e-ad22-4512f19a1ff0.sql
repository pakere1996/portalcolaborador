
-- 1. Unicidade em datas_bloqueadas
ALTER TABLE public.datas_bloqueadas
  DROP CONSTRAINT IF EXISTS datas_bloqueadas_data_key;
ALTER TABLE public.datas_bloqueadas
  ADD CONSTRAINT datas_bloqueadas_data_key UNIQUE (data);

-- 2. Tabela de regras
CREATE TABLE IF NOT EXISTS public.bloqueio_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('fixa_anual', 'dinamica')),
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  dia int CHECK (dia BETWEEN 1 AND 31),
  ordinal int CHECK (ordinal BETWEEN 1 AND 5),
  dia_semana int CHECK (dia_semana BETWEEN 0 AND 6),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloqueio_regras_shape CHECK (
    (tipo = 'fixa_anual' AND dia IS NOT NULL AND ordinal IS NULL AND dia_semana IS NULL)
    OR
    (tipo = 'dinamica' AND dia IS NULL AND ordinal IS NOT NULL AND dia_semana IS NOT NULL)
  )
);

CREATE TRIGGER bloqueio_regras_updated_at
BEFORE UPDATE ON public.bloqueio_regras
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bloqueio_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY bloqueio_regras_read ON public.bloqueio_regras
  FOR SELECT TO authenticated USING (true);
CREATE POLICY bloqueio_regras_admin_all ON public.bloqueio_regras
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Função: calcular data concreta da regra para um ano
CREATE OR REPLACE FUNCTION public.calc_data_regra(_regra public.bloqueio_regras, _ano int)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _first date;
  _first_dow int;
  _offset int;
  _day int;
BEGIN
  IF _regra.tipo = 'fixa_anual' THEN
    -- Pode dar erro em datas tipo 29/02; tenta, senão retorna null
    BEGIN
      RETURN make_date(_ano, _regra.mes, _regra.dia);
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  ELSE
    _first := make_date(_ano, _regra.mes, 1);
    _first_dow := EXTRACT(dow FROM _first)::int;
    _offset := (_regra.dia_semana - _first_dow + 7) % 7;
    _day := 1 + _offset + (_regra.ordinal - 1) * 7;
    -- Valida que ainda está dentro do mês
    IF _day > EXTRACT(day FROM (date_trunc('month', _first) + interval '1 month - 1 day'))::int THEN
      RETURN NULL;
    END IF;
    RETURN make_date(_ano, _regra.mes, _day);
  END IF;
END;
$$;

-- 4. Função: gerar/atualizar datas bloqueadas de um ano
CREATE OR REPLACE FUNCTION public.gerar_bloqueios_ano(_ano int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _r public.bloqueio_regras;
  _d date;
  _count int := 0;
BEGIN
  FOR _r IN SELECT * FROM public.bloqueio_regras WHERE ativo = true LOOP
    _d := public.calc_data_regra(_r, _ano);
    IF _d IS NOT NULL THEN
      INSERT INTO public.datas_bloqueadas (data, motivo, auto, liberada)
      VALUES (_d, _r.descricao, true, false)
      ON CONFLICT (data) DO UPDATE
        SET motivo = EXCLUDED.motivo,
            auto = true
        WHERE public.datas_bloqueadas.liberada = false;
      _count := _count + 1;
    END IF;
  END LOOP;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.gerar_bloqueios_ano(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gerar_bloqueios_ano(int) TO authenticated;

-- 5. Seed regras padrão (idempotente via descricao + tipo + mes)
INSERT INTO public.bloqueio_regras (descricao, tipo, mes, dia, ordinal, dia_semana, ativo)
SELECT * FROM (VALUES
  ('Dia das Mães',        'dinamica',   5,  NULL, 2, 0, true),
  ('Dia dos Pais',        'dinamica',   8,  NULL, 2, 0, true),
  ('Dia dos Namorados',   'fixa_anual', 6,  12,   NULL, NULL, true),
  ('Dia das Crianças',    'fixa_anual', 10, 12,   NULL, NULL, true),
  ('Véspera de Natal',    'fixa_anual', 12, 24,   NULL, NULL, true),
  ('Véspera de Ano Novo', 'fixa_anual', 12, 31,   NULL, NULL, true)
) AS v(descricao, tipo, mes, dia, ordinal, dia_semana, ativo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bloqueio_regras r
  WHERE r.descricao = v.descricao AND r.tipo = v.tipo AND r.mes = v.mes
);

-- 6. Gerar bloqueios para ano corrente e próximo
SELECT public.gerar_bloqueios_ano(EXTRACT(year FROM CURRENT_DATE)::int);
SELECT public.gerar_bloqueios_ano(EXTRACT(year FROM CURRENT_DATE)::int + 1);
