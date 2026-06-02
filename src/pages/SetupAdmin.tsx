import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield, User, IdCard, Mail, Lock, CheckCircle2 } from "lucide-react";
import { formatCPF } from "@/lib/cpf";

export default function SetupAdminPage() {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    senha: "",
  });
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (!form.email.trim() || !form.email.includes("@")) return toast.error("Informe um e-mail válido");
    if (form.cpf.replace(/\D/g, "").length !== 11) return toast.error("CPF inválido");
    if (form.senha.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("bootstrap-admin", {
        body: {
          nome: form.nome.trim(),
          cpf: form.cpf.replace(/\D/g, ""),
          email: form.email.trim().toLowerCase(),
          senha: form.senha,
        },
      });

      if (error) throw error;
      
      toast.success("Administrador criado com sucesso!", {
        description: "Você já pode fazer login com o CPF/email e senha informados.",
      });
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
    } catch (e) {
      toast.error("Erro ao criar administrador", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 to-primary/10">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Shield className="size-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Configuração Inicial</CardTitle>
          <CardDescription>Crie o primeiro administrador do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome" className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" /> Nome Completo
              </Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: João Silva"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf" className="flex items-center gap-2">
                <IdCard className="size-4 text-muted-foreground" /> CPF
              </Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" /> E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@pakere.com.br"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha" className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" /> Senha
              </Label>
              <Input
                id="senha"
                type="password"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <Button type="submit" className="w-full h-12 font-bold" disabled={busy}>
              {busy ? "Criando..." : (
                <>
                  <CheckCircle2 className="size-4 mr-2" /> Criar Administrador
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}