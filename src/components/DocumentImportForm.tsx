useEffect(() => {
  if (!user) return;
  const fetchProfiles = async () => {
    let query = supabase
      .from("profiles")
      .select("id, nome, cpf, matricula, unidade_id, possui_folha_ponto")
      .eq("ativo", true);
    
    // 🔥 Se for folha de ponto, filtra apenas quem tem permissão
    if (documentType === "ponto") {
      query = query.eq("possui_folha_ponto", true);
    }
    
    const { data } = await query.order("nome");
    setProfiles((data ?? []) as ProfileForMatching[]);
  };
  fetchProfiles();

  supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome")
    .then(({ data }) => setUnidades(data ?? []));
  supabase.from("cargos").select("id, nome").order("nome")
    .then(({ data }) => setListaCargos(data ?? []));
}, [user?.id, documentType]);