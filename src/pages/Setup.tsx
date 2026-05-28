import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cpfToEmail, formatCPF, isValidCPFLength, onlyDigits } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import logo from "@/assets/pakere-logo.png";

export default function SetupPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Informe seu nome");
    if (!isValidCPFLength(cpf)) return toast.error("CPF inválido");
    if (password.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");

    setBusy(true);
    const { count } = await supabase
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if ((count ?? 0) > 0) {
      setBusy(false);
      toast.error("Já existe um administrador. Faça login.");
      navigate("/login");
      return;
    }

    const cpfDigits = onlyDigits(cpf);
    const { data, error } = await supabase.auth.signUp({
      email: cpfToEmail(cpf),
      password,
      options: {
        data: { nome: nome.trim(), cpf: cpfDigits, cargo: "Administrador", criado_por_admin: true },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error("Erro ao criar conta", { description: error?.message });
      return;
    }

    const { error: rpcErr } = await supabase.rpc("promote_first_admin", { _user_id: data.user.id });
    if (rpcErr) {
      setBusy(false);
      toast.error("Conta criada, mas não foi possível promover a admin.", { description: rpcErr.message });
      return;
    }

    setBusy(false);
    toast.success("Administrador criado! Faça login.");
    await supabase.auth.signOut();
    navigate("/login");
  };

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
        </form>
      </div>
    </div>
  );
}