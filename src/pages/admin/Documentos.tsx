"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
// ... existing code ...
  useEffect(() => {
    loadData();
  }, [tipo]);

  const loadData = async () => {
    console.log("[DEBUG] Iniciando loadData...");
    try {
      // Query de colaboradores: select("id, nome, cpf, matricula, unidade_id").eq("ativo", true).order("nome")
      const [profilesRes, docsRes, suggestedRes, unidadesRes, cargosRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, cpf, matricula, unidade_id").eq("ativo", true).order("nome"),
        supabase.from("documentos").select("*").eq("tipo", tipo).order("created_at", { ascending: false }),
// ... existing code ...
      ]);

      const loadedUnidades = (unidadesRes.data ?? []) as Unidade[];
      const loadedProfiles = (profilesRes.data ?? []) as Profile[];
      
      console.log("[DEBUG] Query de Perfis: profiles?select=id,nome,cpf,matricula,unidade_id&ativo=eq.true");
      console.log("[DEBUG] Perfis Carregados (Bruto):", loadedProfiles);

      setProfiles(loadedProfiles);
      setUnidades(loadedUnidades);
      setCargos((cargosRes.data ?? []) as Cargo[]);

      // Selecionar a primeira unidade ativa como padrão
// ... existing code ...