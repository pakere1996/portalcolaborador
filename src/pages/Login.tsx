import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { IdCard, Lock } from "lucide-react";
import { formatCPF } from "@/lib/cpf";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

  // Função para buscar role e redirecionar com replace forçado
  const redirectUser = async (userId: string) => {
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (rolesError) {
        console.error("Erro ao buscar roles:", rolesError);
        toast.error("Erro ao verificar permissões");
        return;
      }

      const role = rolesData?.role;
      console.log('🔍 Role encontrado:', role);

      if (role) {
        localStorage.setItem('user_role', role);
      } else {
        localStorage.removeItem('user_role');
      }

      // 🔥 Força o redirecionamento com reload da página para garantir que o contexto seja atualizado
      if (role === "admin") {
        window.location.replace("/admin/home");
      } else {
        window.location.replace("/home");
      }
    } catch (error) {
      console.error("Erro ao redirecionar:", error);
      toast.error("Erro ao verificar permissões");
    }
  };

  // Se já estiver logado, redireciona
  useEffect(() => {
    if (loading) return;

    if (session?.user?.id) {
      const savedRole = localStorage.getItem('user_role');
      if (savedRole) {
        console.log('🔍 Role do localStorage:', savedRole);
        if (savedRole === "admin") {
          window.location.replace("/admin/home");
        } else {
          window.location.replace("/home");
        }
        return;
      }
      redirectUser(session.user.id);
    }
  }, [session, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf.trim() || !senha.trim()) {
      toast.error("Preencha CPF e senha");
      return;
    }
    setBusy(true);
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const { data, error } = await supabase.functions.invoke("login-with-cpf", {
        body: { cpf: cleanCpf, senha },
      });
      if (error) throw error;

      if (data?.session) {
        await supabase.auth.setSession(data.session);
        toast.success("Login realizado com sucesso!");
        
        if (data.user?.id) {
          await redirectUser(data.user.id);
        } else {
          window.location.replace("/home");
        }
      } else {
        toast.error("Resposta inválida do servidor");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao fazer login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Portal do Colaborador</h1>
          <p className="text-muted-foreground">Acesse sua conta usando CPF e senha</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cpf" className="flex items-center gap-2">
              <IdCard className="size-4 text-muted-foreground" /> CPF
            </Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha" className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" /> Senha
            </Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full h-12" disabled={busy}>
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Esqueceu sua senha? Entre em contato com o administrador.
          </p>
        </div>
      </div>
    </div>
  );
}