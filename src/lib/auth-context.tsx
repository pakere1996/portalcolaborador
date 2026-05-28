import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
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
  const lastLoadedUid = useRef<string | null>(null);

  const loadProfile = async (uid: string) => {
    // Evita carregar o mesmo perfil múltiplas vezes em sucessão rápida
    if (lastLoadedUid.current === uid && profile && role) {
      setLoading(false);
      return;
    }
    
    console.log("[Auth] Carregando dados para o usuário:", uid);
    lastLoadedUid.current = uid;
    
    try {
      const [profRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid)
      ]);

      if (profRes.error) console.error("[Auth] Erro Perfil:", profRes.error.message);
      if (rolesRes.error) console.error("[Auth] Erro Roles:", rolesRes.error.message);

      const p = profRes.data as Profile | null;
      
      if (p && p.ativo === false) {
        console.warn("[Auth] Usuário inativo detectado.");
        await supabase.auth.signOut();
        return;
      }

      const roles = (rolesRes.data ?? []).map((x: any) => x.role);
      console.log("[Auth] Roles encontradas no banco:", roles);

      setProfile(p);
      
      if (roles.includes("admin")) {
        setRole("admin");
      } else if (roles.includes("funcionario")) {
        setRole("funcionario");
      } else {
        setRole(null);
      }
      
    } catch (err) {
      console.error("[Auth] Falha crítica no carregamento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Verifica sessão inicial
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        loadProfile(s.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Monitora mudanças (Login/Logout/Refresh)
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[Auth] Evento:", event);
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setRole(null);
        lastLoadedUid.current = null;
        setLoading(false);
        return;
      }

      if (currentSession) {
        setSession(currentSession);
        loadProfile(currentSession.user.id);
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