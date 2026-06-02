import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/pakere-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { IdCard, Lock } from "lucide-react";
import { formatCPF } from "@/lib/cpf";

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate(role === "admin" ? "/admin" : "/calendario", { replace: true });
    }
  }, [loading, session, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.error("CPF inválido", { description: "Digite um CPF com 11 dígitos." });
      return;
    }
    
    if (!password) {
      toast.error("Senha obrigatória", { description: "Informe sua senha." });
      return;
    }

    setBusy(true);
    
    const { data, error } = await supabase.functions.invoke("login-with-cpf", {
      body: { cpf: cleanCpf, senha: password },
    });

    setBusy(false);

    if (error) {
      console.error("[Login] Erro:", error);
      toast.error("Acesso negado", { description: error.message });
      return;
    }

    if (data?.error) {
      toast.error("Acesso negado", { description: data.error });
      return;
    }

    // A sessão já foi estabelecida pela função
    toast.success("Login realizado com sucesso!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-20 rounded-2xl bg-card border border-border mb-4 overflow-hidden shadow-lg">
            <img src={logo} alt="Pakerê Pizzaria" className="size-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold">Portal do Colaborador</h1>
          <p className="text-muted-foreground mt-1">Acesso à plataforma</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4"
        >
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
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" /> Senha
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full h-12 text-base font-bold" disabled={busy}>
            {busy ? "Verificando..." : "Entrar"}
          </Button>
          
          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Esqueceu sua senha? Entre em contato com o administrador.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}