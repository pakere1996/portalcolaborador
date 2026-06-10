import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
// ... existing code ...
import { Badge } from "@/components/ui/badge";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Profile {
// ... existing code ...
  data_demissao: string | null;
  data_nascimento: string | null;
  folga_fixa_semana: number | null;
  role?: string;
  created_at: string; // Adicionando created_at na interface
}

const blankForm = {
// ... existing code ...
  folgaFixa: "",
};

export default function Funcionarios() {
// ... existing code ...
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const load = async () => {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, cpf, email, cargo, ativo, aprovacao_status, data_admissao, data_demissao, data_nascimento, folga_fixa_semana, created_at") // Adicionado created_at
        .order("nome"),
      supabase.from("user_roles").select("user_id, role")
    ]);

    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
    
    const combined = (profs ?? []).map(p => ({
      ...p,
      role: roleMap.get(p.id) || "funcionario"
    }));

    setList(combined as Profile[]);
  };

  useEffect(() => { load(); }, []);

// ... existing code ...