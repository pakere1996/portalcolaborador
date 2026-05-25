
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

REVOKE EXECUTE ON FUNCTION public.promote_first_admin(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.folgas_dates_in_range(date, date) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_bloqueios_ano(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_data_regra(public.bloqueio_regras, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_prioridades_aniversario(integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.processar_troca() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sortear_folgas_mes(integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validar_folga_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own notif channel" ON realtime.messages;
CREATE POLICY "users can read own notif channel"
  ON realtime.messages FOR SELECT TO authenticated
  USING (realtime.topic() LIKE 'notif:' || auth.uid()::text || ':%');

DROP POLICY IF EXISTS "users can join own notif channel" ON realtime.messages;
CREATE POLICY "users can join own notif channel"
  ON realtime.messages FOR INSERT TO authenticated
  WITH CHECK (realtime.topic() LIKE 'notif:' || auth.uid()::text || ':%');
