import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/pakere-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate(role === "admin" ? "/admin" : "/calendario", { replace: true });
    }
  }, [loading, session, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !email.includes("@")) {
      toast.error("E-mail inválido", { description: "Por favor, insira um endereço de e-mail válido." });
      return;
    }
    
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    setBusy(false);
    
    if (error) {
      console.error("[Login] Erro:", error);
      
      if (error.message === "Invalid login credentials") {
        toast.error("Acesso negado", { 
          description: "E-mail ou senha incorretos. Verifique seus dados." 
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
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" /> E-mail
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@exemplo.com"
              autoFocus
              autoComplete="email"
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