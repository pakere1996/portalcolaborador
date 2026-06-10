import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
// ... existing code ...
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const load = async () => {
    const [{ data: profs, error }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, cpf, email, cargo, ativo, aprovacao_status, data_admissao, data_demissao, data_nascimento, folga_fixa_semana, created_at")
        .order("nome"),
      supabase.from("user_roles").select("user_id, role")
    ]);

    console.log('PROFILES:', profs, 'ERROR:', error);

    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
    
    const combined = (profs ?? []).map(p => ({
      ...p,
      role: roleMap.get(p.id) || "funcionario"
    }));

    setList(combined as Profile[]);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
// ... existing code ...