
REVOKE EXECUTE ON FUNCTION public.folgas_dates_in_range(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gerar_prioridades_aniversario(integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.processar_troca() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_folga_insert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
