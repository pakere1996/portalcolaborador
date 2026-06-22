import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
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

const AtestadosPendentesContext = createContext<AtestadosPendentesContextType | undefined>(undefined);

export function AtestadosPendentesProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [pendentes, setPendentes] = useState<AtestadoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const isMounted = useRef(true);

  const isAdmin = role === "admin" || localStorage.getItem("user_role") === "admin";

  const carregarPendentes = useCallback(async () => {
    if (!isMounted.current) return;
    if (!isAdmin) {
      setPendentes([]);
      setLoading(false);
      setInitialLoadDone(true);
      return;
    }

    // Se já carregou uma vez e não é uma atualização forçada, não recarrega
    if (initialLoadDone && !loading) {
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
        setInitialLoadDone(true);
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
      console.error("[Atestados] Erro ao carregar:", error);
      setPendentes([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setInitialLoadDone(true);
      }
    }
  }, [isAdmin, initialLoadDone, loading]);

  // Carregamento inicial
  useEffect(() => {
    isMounted.current = true;
    if (user) {
      carregarPendentes();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted.current = false;
    };
  }, [user, carregarPendentes]);

  // Atualização periódica apenas se for admin
  useEffect(() => {
    if (!isAdmin || !user) return;
    const interval = setInterval(() => {
      carregarPendentes();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin, user, carregarPendentes]);

  const totalPendentes = pendentes.length;

  return (
    <AtestadosPendentesContext.Provider
      value={{
        pendentes,
        totalPendentes,
        loading,
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
  const context = useContext(AtestadosPendentesContext);
  if (context === undefined) {
    throw new Error("useAtestadosPendentes deve ser usado dentro de um AtestadosPendentesProvider");
  }
  return context;
}