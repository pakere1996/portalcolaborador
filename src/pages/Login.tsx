import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SocialLoginButtons } from "@/components/SocialLoginButtons";
import { IdCard, Lock } from "lucide-react";
import { formatCPF } from "@/lib/cpf";

export default function LoginPage() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);

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
      // login-with-cpf returns { success: true, session, user }
      if (data?.session) {
        // Supabase auth already set session via the edge function? 
        // The edge function returns session; we can set it via supabase.auth.setSession?
        // Actually the edge function returns the session object; we can use supabase.auth.setSession
        await supabase.auth.setSession(data.session);
        toast.success("Login realizado com sucesso!");
        navigate("/calendario", { replace: true });
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

        <SocialLoginButtons />
      </div>
    </div>
  );
}