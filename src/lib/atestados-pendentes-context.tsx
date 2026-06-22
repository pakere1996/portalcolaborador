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
  carregarPendentes: () => Promise<void>;
}

const AtestadosPendentesContext = createContext<AtestadosPendentesContextType>({
  pendentes: [],
  totalPendentes: 0,
  loading: true,
  showNotification: false,
  setShowNotification: () => {},
  carregarPendentes: async () => {},
});

export function AtestadosPendentesProvider({ children }: { children: ReactNode }) {
  const { role, user } = useAuth();
  const [pendentes, setPendentes] = useState<AtestadoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const isAdmin = role === "admin" || localStorage.getItem("user_role") === "admin";

  const carregarPendentes = useCallback(async () => {
    // Se não for admin, não faz nada
    if (!isAdmin || !user) {
      setPendentes([]);
      setLoading(false);
      setInitialLoadDone(true);
      return;
    }

    // Se já carregou inicialmente e está tentando carregar de novo, não mostra loading
    const shouldShowLoading = !initialLoadDone;
    if (shouldShowLoading) {
      setLoading(true);
    }

    try {
      const { data: atestados, error } = await supabase
        .from("atestados")
        .select(`
          id,
          colaborador_id,
          data_atestado,
          dias_afastamento,
          created_at,
          profiles!colaborador_id (nome)
        `)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const pendentesFormatados: AtestadoPendente[] = (atestados || []).map((item: any) => ({
        id: item.id,
        colaborador_id: item.colaborador_id,
        colaborador_nome: item.profiles?.nome || "Colaborador",
        data_atestado: item.data_atestado,
        dias_afastamento: item.dias_afastamento,
        created_at: item.created_at,
      }));

      setPendentes(pendentesFormatados);
    } catch (error) {
      console.error("[Atestados] Erro ao carregar:", error);
      setPendentes([]);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [isAdmin, user, initialLoadDone]);

  // Carrega na montagem e a cada 30 segundos
  useEffect(() => {
    if (!user) return;

    // Primeira carga
    carregarPendentes();

    // Intervalo
    const interval = setInterval(() => {
      carregarPendentes();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, carregarPendentes]);

  const totalPendentes = pendentes.length;

  return (
    <AtestadosPendentesContext.Provider
      value={{
        pendentes,
        totalPendentes,
        loading: loading && !initialLoadDone, // Só mostra loading na primeira vez
        showNotification,
        setShowNotification,
        carregarPendentes,
      }}
    >
      {children}
    </AtestadosPendentesContext.Provider>
  );
}

export function useAtestadosPendentes() {
  return useContext(AtestadosPendentesContext);
}