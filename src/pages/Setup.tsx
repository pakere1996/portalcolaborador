import { useNavigate, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cpfToEmail, formatCPF, isValidCPFLength, onlyDigits } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import logo from "@/assets/pakere-logo.png";

export default function SetupPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmins() {
      // Usamos uma busca simples. Se houver erro de permissão, assumimos que pode haver um admin
      const { count, error } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");

      if (error) {
        console.warn("[Setup] Erro ao verificar admins (provavelmente RLS):", error);
        // Se deu erro de permissão, é provável que já existam dados e a RLS barrou
      } else if ((count ?? 0) > 0) {
        toast.info("O sistema já possui um administrador configurado.");
        navigate("/login");
      }
      setChecking(false);
    }
    checkAdmins();
  }, [navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Informe seu nome");
    if (!isValidCPFLength(cpf)) return toast.error("CPF inválido");
    if (password.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");

    setBusy(true);
    const cpfDigits = onlyDigits(cpf);
    
    const { data, error } = await supabase.auth.signUp({
      email: cpfToEmail(cpf),
      password,
      options: {
        data: { nome: nome.trim(), cpf: cpfDigits, cargo: "Administrador", criado_por_admin: true },
      },
    });

    if (error || !data.user) {
      setBusy(false);
      toast.error("Erro ao criar conta", { description: error?.message });
      return;
    }

    // Tenta promover a admin via RPC
    const { error: rpcErr } = await supabase.rpc("promote_first_admin", { _user_id: data.user.id });
    
    setBusy(false);
    if (rpcErr) {
      toast.error("Conta criada, mas houve erro na promoção. Contate o suporte.");
    } else {
      toast.success("Administrador criado com sucesso!");
      await supabase.auth.signOut();
      navigate("/login");
    }
  };

  if (checking) return <div className="min-h-screen flex items-center justify-center">Verificando sistema...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-card border border-border mb-4 overflow-hidden">
            <img src={logo} alt="Pakerê" className="size-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Configuração inicial
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Crie a conta do primeiro administrador (uma única vez).
          </p>
        </div>
        <form onSubmit={handle} className="bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>CPF</Label>
            <Input
              inputMode="numeric"
              value={cpf}
              onChange={(e) => setCpf(formatCPF(e.target.value))}
              maxLength={14}
              placeholder="000.000.000-00"
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button className="w-full" disabled={busy}>
            {busy ? "Criando..." : "Criar administrador"}
          </Button>
          
          <div className="pt-2 border-t border-border mt-4">
            <Link to="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2">
              <ArrowLeft className="size-4" /> Já tenho cadastro, ir para Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}