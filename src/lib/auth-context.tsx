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
    console.log("[Auth] Iniciando carregamento de dados para:", uid);
    
    try {
      // Carregamos perfil e roles em paralelo para performance
      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid)
      ]);

      if (profRes.error) {
        console.error("[Auth] Erro ao buscar perfil:", profRes.error);
      }
      
      if (rolesRes.error) {
        console.error("[Auth] Erro ao buscar roles:", rolesRes.error);
      }

      const p = profRes.data as Profile | null;
      
      if (p && p.ativo === false) {
        console.warn("[Auth] Usuário inativo, deslogando...");
        await supabase.auth.signOut();
        return;
      }

      setProfile(p);
      
      const roles = (rolesRes.data ?? []).map((x: any) => x.role);
      console.log("[Auth] Roles encontradas:", roles);

      if (roles.includes("admin")) {
        setRole("admin");
      } else if (roles.includes("funcionario")) {
        setRole("funcionario");
      } else {
        // Se não tem role no banco, mas o usuário existe, pode ser um erro de sincronização
        console.warn("[Auth] Nenhuma role encontrada para o usuário.");
        setRole(null);
      }
      
    } catch (err) {
      console.error("[Auth] Erro crítico no loadProfile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Verificar sessão atual imediatamente
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        console.log("[Auth] Sessão inicial encontrada");
        setSession(s);
        loadProfile(s.user.id);
      } else {
        console.log("[Auth] Nenhuma sessão inicial");
        setLoading(false);
      }
    });

    // 2. Ouvir mudanças de estado (login/logout)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[Auth] Evento de autenticação:", event);
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      if (currentSession) {
        setSession(currentSession);
        await loadProfile(currentSession.user.id);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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