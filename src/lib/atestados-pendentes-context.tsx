import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface AtestadoPendente {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_atestado: string;
  dias_afastamento: number;
  created_at: string;
}

interface AtestadosPendentesContextType {
  pendentes: AtestadoPendente[];
  totalPendentes: number;
  loading: boolean;
  showNotification: boolean;
  setShowNotification: (show: boolean) => void;
  reload: () => Promise<void>;
}

const AtestadosPendentesContext = createContext<AtestadosPendentesContextType>({
  pendentes: [],
  totalPendentes: 0,
  loading: true,
  showNotification: false,
  setShowNotification: () => {},
  reload: async () => {},
});

export function AtestadosPendentesProvider({ children }: { children: ReactNode }) {
  const { role, user } = useAuth();
  const [pendentes, setPendentes] = useState<AtestadoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);

  const isAdmin = role === "admin" || localStorage.getItem("user_role") === "admin";

  const load = useCallback(async () => {
    // Se não for admin, não carrega nada
    if (!isAdmin) {
      setPendentes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: atestados, error: atestadosError } = await supabase
        .from("atestados")
        .select("id, colaborador_id, data_atestado, dias_afastamento, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (atestadosError) throw atestadosError;

      if (!atestados || atestados.length === 0) {
        setPendentes([]);
        setLoading(false);
        return;
      }

      const colaboradorIds = [...new Set(atestados.map((a) => a.colaborador_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", colaboradorIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map((p) => [p.id, p.nome]) ?? []);

      const pendentesFormatados: AtestadoPendente[] = atestados.map((item) => ({
        id: item.id,
        colaborador_id: item.colaborador_id,
        colaborador_nome: profileMap.get(item.colaborador_id) ?? "Colaborador",
        data_atestado: item.data_atestado,
        dias_afastamento: item.dias_afastamento,
        created_at: item.created_at,
      }));

      setPendentes(pendentesFormatados);
    } catch (error) {
      console.error("Erro ao carregar atestados pendentes:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  // Carregamento inicial e recarga a cada 30 segundos
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const totalPendentes = pendentes.length;

  return (
    <AtestadosPendentesContext.Provider
      value={{
        pendentes,
        totalPendentes,
        loading,
        showNotification,
        setShowNotification,
        reload: load,
      }}
    >
      {children}
    </AtestadosPendentesContext.Provider>
  );
}

export function useAtestadosPendentes() {
  return useContext(AtestadosPendentesContext);
}
