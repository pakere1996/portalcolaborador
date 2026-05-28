import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/pakere-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cpfToEmail, formatCPF, isValidCPFLength, onlyDigits } from "@/lib/cpf";
import { toast } from "sonner";

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
    
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) {
      toast.error("CPF incompleto", { description: "Digite os 11 dígitos do CPF." });
      return;
    }
    
    const email = cpfToEmail(cpf);
    console.log("[Login] Tentativa de acesso:", { email, passwordLength: password.length });
    
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    
    if (error) {
      console.error("[Login] Erro retornado pelo Supabase:", error);
      
      if (error.message === "Invalid login credentials") {
        toast.error("Acesso negado", { 
          description: "CPF ou senha incorretos. Verifique se o Caps Lock está ativado." 
        });
      } else {
        toast.error("Erro no servidor", { description: error.message });
      }
      return;
    }
    
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
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              maxLength={14}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
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