REVOKE EXECUTE ON FUNCTION public.sortear_folgas_mes(int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sortear_folgas_mes(int, int) TO service_role;