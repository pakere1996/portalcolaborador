import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";

interface Folga { id: string; data: string; tipo: string; created_at: string; criado_por: string | null }
interface Solic { id: string; data: string; motivo: string; status: string; resposta_admin: string | null; created_at: string }

export default function HistoricoPage() {
  const { user } = useAuth();
  const [folgas, setFolgas] = useState<Folga[]>([]);
  const [solics, setSolics] = useState<Solic[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase.from("folgas").select("id, data, tipo, created_at, criado_por").eq("user_id", user.id).order("data", { ascending: false }),
        supabase.from("solicitacoes_especiais").select("id, data, motivo, status, resposta_admin, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setFolgas((f ?? []) as Folga[]);
      setSolics((s ?? []) as Solic[]);
    })();
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ClipboardList className="size-6 text-primary" /> Histórico
        </h1>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Suas folgas</h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {folgas.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhuma folga registrada.</div>
          )}
          {folgas.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">{formatBR(parseYMD(f.data))}</div>
                <div className="text-xs text-muted-foreground capitalize">{f.tipo}</div>
              </div>
              {f.criado_por === null && (
                <Badge className="bg-pending/20 text-pending-foreground border border-pending/40">
                  Atribuída pelo sistema
                </Badge>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Suas solicitações especiais</h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {solics.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhuma solicitação enviada.</div>
          )}
          {solics.map((s) => (
            <div key={s.id} className="p-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{formatBR(parseYMD(s.data))}</div>
                <StatusBadge status={s.status} />
              </div>
              <div className="text-sm text-muted-foreground">{s.motivo}</div>
              {s.resposta_admin && (
                <div className="text-xs text-muted-foreground mt-1">
                  <b>Resposta:</b> {s.resposta_admin}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "aprovada") return <Badge className="bg-available/20 text-available border border-available/40">Aprovada</Badge>;
  if (status === "recusada") return <Badge className="bg-unavailable/20 text-unavailable border border-unavailable/40">Recusada</Badge>;
  return <Badge className="bg-pending/20 text-pending-foreground border border-pending/40">Pendente</Badge>;
}