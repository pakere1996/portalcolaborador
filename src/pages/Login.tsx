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
import { Search, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      navigate(role === "admin" ? "/admin" : "/calendario", { replace: true });
    }
  }, [loading, session, role, navigate]);

  const checkCPFStatus = async () => {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return toast.error("Digite o CPF completo para verificar");
    
    setBusy(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("nome, aprovacao_status, ativo")
      .eq("cpf", digits)
      .maybeSingle();
    setBusy(false);

    if (error) return toast.error("Erro ao consultar banco");
    if (!data) {
      setDebugInfo("CPF não encontrado no sistema. Verifique se o cadastro foi realizado.");
    } else {
      const status = data.aprovacao_status === 'pendente' ? "Aguardando Aprovação" : 
                     data.aprovacao_status === 'recusado' ? "Recusado" : 
                     !data.ativo ? "Desativado" : "Ativo";
      setDebugInfo(`Usuário: ${data.nome}\nStatus: ${status}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCPFLength(cpf)) {
      toast.error("CPF inválido", { description: "Digite os 11 dígitos do CPF." });
      return;
    }
    
    const email = cpfToEmail(cpf);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    
    if (error) {
      toast.error("Não foi possível entrar", { 
        description: error.message === "Invalid login credentials" 
          ? "CPF ou senha incorretos." 
          : `Erro: ${error.message}` 
      });
      return;
    }
    toast.success("Bem-vindo!");
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
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <div className="flex gap-2">
              <Input
                id="cpf"
                className="flex-1"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => {
                  setCpf(formatCPF(e.target.value));
                  setDebugInfo(null);
                }}
                placeholder="000.000.000-00"
                maxLength={14}
                autoFocus
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon" 
                title="Verificar status do CPF"
                onClick={checkCPFStatus}
                disabled={busy}
              >
                <Search className="size-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {debugInfo && (
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-2 items-start animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="size-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 whitespace-pre-line font-medium">
                {debugInfo}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Processando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}