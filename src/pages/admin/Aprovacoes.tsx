import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCheck, Check, X } from "lucide-react";
import { formatCPF } from "@/lib/cpf";
import { adminApproveUser } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/admin/aprovacoes")({
  component: AprovacoesPage,
});

interface Pend {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  created_at: string;
}

function AprovacoesPage() {
  const [list, setList] = useState<Pend[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const approveFn = useServerFn(adminApproveUser);

  const load = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, cpf, cargo, created_at")
      .eq("aprovacao_status", "pendente")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data ?? []) as Pend[]);
  };
  useEffect(() => {
    load();
  }, []);

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await approveFn({ data: { targetUserId: id, approve } });
      toast.success(approve ? "Cadastro aprovado" : "Cadastro recusado");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <UserCheck className="size-6 text-primary" /> Aprovações de cadastro
        </h1>
        <p className="text-muted-foreground mt-1">
          Novos usuários precisam ser aprovados antes de acessar o sistema.
        </p>
      </div>

      <div className="space-y-3">
        {list.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
            Nenhum cadastro pendente.
          </div>
        )}
        {list.map((p) => (
          <div
            key={p.id}
            className="bg-card border border-pending/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <div className="font-medium">{p.nome}</div>
              <div className="text-sm text-muted-foreground">
                CPF: {formatCPF(p.cpf)} • {p.cargo}
              </div>
              <div className="text-xs text-muted-foreground">
                Solicitado em {new Date(p.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy === p.id}
                onClick={() => decide(p.id, false)}
              >
                <X className="size-4" /> Recusar
              </Button>
              <Button disabled={busy === p.id} onClick={() => decide(p.id, true)}>
                <Check className="size-4" /> Aprovar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
