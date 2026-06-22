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
  const { role } = useAuth();
  const [pendentes, setPendentes] = useState<AtestadoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);

  // Determina se é admin (usando role e fallback localStorage)
  const isAdmin = role === "admin" || localStorage.getItem("user_role") === "admin";

  // Função para carregar os pendentes
  const carregarPendentes = useCallback(async () => {
    console.log("[Atestados] Iniciando carregamento...");
    
    if (!isAdmin) {
      console.log("[Atestados] Usuário não é admin, definindo loading false");
      setPendentes([]);
      setLoading(false);
      return;
    }

    // Se não for admin, já definimos loading false acima; se for admin, setamos true
    setLoading(true);
    
    try {
      console.log("[Atestados] Buscando atestados pendentes no Supabase...");
      const { data: atestados, error: atestadosError } = await supabase
        .from("atestados")
        .select("id, colaborador_id, data_atestado, dias_afastamento, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (atestadosError) {
        console.error("[Atestados] Erro na consulta de atestados:", atestadosError);
        throw atestadosError;
      }

      console.log(`[Atestados] Encontrados ${atestados?.length || 0} atestados pendentes`);

      if (!atestados || atestados.length === 0) {
        console.log("[Atestados] Nenhum atestado pendente, definindo lista vazia");
        setPendentes([]);
        setLoading(false);
        return;
      }

      // Busca os nomes dos colaboradores
      const colaboradorIds = [...new Set(atestados.map((a) => a.colaborador_id))];
      console.log(`[Atestados] Buscando perfis para ${colaboradorIds.length} colaboradores`);
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", colaboradorIds);

      if (profilesError) {
        console.error("[Atestados] Erro ao buscar perfis:", profilesError);
        throw profilesError;
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p.nome]) ?? []);
      console.log(`[Atestados] Mapeamento de nomes criado, ${profileMap.size} perfis encontrados`);

      const pendentesFormatados: AtestadoPendente[] = atestados.map((item) => ({
        id: item.id,
        colaborador_id: item.colaborador_id,
        colaborador_nome: profileMap.get(item.colaborador_id) ?? "Colaborador",
        data_atestado: item.data_atestado,
        dias_afastamento: item.dias_afastamento,
        created_at: item.created_at,
      }));

      setPendentes(pendentesFormatados);
      console.log(`[Atestados] ${pendentesFormatados.length} atestados formatados e salvos`);
    } catch (error) {
      console.error("[Atestados] Erro geral no carregamento:", error);
      // Em caso de erro, definimos array vazio para não quebrar a UI
      setPendentes([]);
    } finally {
      console.log("[Atestados] Finalizando carregamento, setLoading(false)");
      setLoading(false);
    }
  }, [isAdmin]);

  // Efeito para carregar na montagem e a cada 30 segundos
  useEffect(() => {
    console.log("[Atestados] useEffect montado, chamando carregarPendentes");
    carregarPendentes();

    const interval = setInterval(() => {
      console.log("[Atestados] Intervalo de 30s: recarregando...");
      carregarPendentes();
    }, 30000);

    return () => {
      console.log("[Atestados] Desmontando, limpando intervalo");
      clearInterval(interval);
    };
  }, []); // Array vazio para evitar recriação do efeito

  const totalPendentes = pendentes.length;

  return (
    <AtestadosPendentesContext.Provider value={{
      pendentes,
      totalPendentes,
      loading,
      showNotification,
      setShowNotification,
      carregarPendentes,
    }}>
      {children}
    </AtestadosPendentesContext.Provider>
  );
}

export function useAtestadosPendentes() {
  return useContext(AtestadosPendentesContext);
}