import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "funcionario";

interface Profile {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  ativo: boolean;
  aprovacao_status?: string;
  data_admissao?: string | null;
  data_demissao?: string | null;
  data_nascimento?: string | null;
  folga_fixa_semana?: number | null;
  endereco?: string | null;
  email_contato?: string | null;
  whatsapp?: string | null;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    try {
      console.log("[Auth] Iniciando busca de dados para:", uid);
      
      // Buscamos perfil e roles separadamente para evitar que um erro em um trave o outro
      const { data: p, error: pErr } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (pErr) console.error("[Auth] Erro ao carregar perfil:", pErr);

      const { data: r, error: rErr } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (rErr) console.error("[Auth] Erro ao carregar roles:", rErr);

      if (p && p.ativo === false) {
        console.warn("[Auth] Usuário inativo.");
        await supabase.auth.signOut();
        return;
      }

      setProfile(p as Profile);
      const roles = (r ?? []).map((x: any) => x.role);
      
      if (roles.includes("admin")) {
        setRole("admin");
      } else if (roles.includes("funcionario")) {
        setRole("funcionario");
      } else {
        setRole(null);
      }
      
      console.log("[Auth] Dados carregados com sucesso.");
    } catch (err) {
      console.error("[Auth] Erro inesperado:", err);
    } finally {
      // Garante que o loading termine sempre
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[Auth] Evento Supabase:", event);
      setSession(currentSession);
      
      if (currentSession?.user) {
        await loadProfile(currentSession.user.id);
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setRole(null);
    window.location.href = "/login";
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthCtx.Provider
      value={{ session, user: session?.user ?? null, profile, role, loading, signOut, refresh }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}