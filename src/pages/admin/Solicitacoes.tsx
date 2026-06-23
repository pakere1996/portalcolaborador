import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatBR, parseYMD, dayType, monthKey } from "@/lib/folga-rules";
import { ClipboardList, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { FavoritarBotao } from "@/components/FavoritarBotao"; // <-- importação adicionada

interface Solic {
  id: string; user_id: string; data: string; motivo: string;
  status: string; resposta_admin: string | null; created_at: string;
  nome?: string;
}

export default function SolicPage() {
  const { user } = useAuth();
  const [list, setList] = useState<Solic[]>([]);
  const [resp, setResp] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase
      .from("solicitacoes_especiais").select("*").order("created_at", { ascending: false });
    const items = (data ?? []) as Solic[];
    const uids = Array.from(new Set(items.map((x) => x.user_id)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", uids);
      const nm = new Map((profs ?? []).map((p) => [p.id, p.nome]));
      items.forEach((i) => (i.nome = nm.get(i.user_id)));
    }
    setList(items);
  };
  useEffect(() => { load(); }, []);

  const decide = async (s: Solic, approve: boolean) => {
    if (!user) return;
    const resposta = resp[s.id]?.trim() || (approve ? "Aprovado" : "Recusado");
    const { error } = await supabase.from("solicitacoes_especiais").update({
      status: approve ? "aprovada" : "recusada",
      resposta_admin: resposta,
      respondido_por: user.id,
      respondido_em: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) return toast.error(error.message);

    if (approve) {
      await supabase.from("datas_bloqueadas").upsert(
        { data: s.data, motivo: "Liberada por solicitação", liberada: true, auto: false },
        { onConflict: "data" },
      );
      const d = parseYMD(s.data);
      const tipo = dayType(d);
      if (tipo) {
        const { error: ferr } = await supabase.from("folgas").insert({
          user_id: s.user_id, data: s.data, mes: monthKey(d), tipo, criado_por: user.id,
        });
        if (ferr && !ferr.message.includes("duplicate")) {
          toast.warning("Aprovada, mas folga não criada", { description: ferr.message });
        }
      }
    }
    toast.success(approve ? "Solicitação aprovada" : "Solicitação recusada");
    load();
  };

  const pendentes = list.filter((l) => l.status === "pendente");
  const outras = list.filter((l) => l.status !== "pendente");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6 text-primary" /> Solicitações
          </h1>
          <p className="text-muted-foreground mt-1">Aprove ou recuse pedidos especiais.</p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/solicitacoes" label="Solicitações" icone="ClipboardList" />
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-3">Pendentes</h2>
        <div className="space-y-3">
          {pendentes.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
              Nenhuma solicitação pendente.
            </div>
          )}
          {pendentes.map((s) => (
            <div key={s.id} className="bg-card border border-pending/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium">{s.nome ?? "Funcionário"}</div>
                  <div className="text-sm text-muted-foreground">
                    Solicitando: <b>{formatBR(parseYMD(s.data))}</b>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="text-sm bg-muted/20 rounded-lg p-3">{s.motivo}</div>
              <Textarea
                placeholder="Resposta (opcional)"
                value={resp[s.id] ?? ""}
                onChange={(e) => setResp({ ...resp, [s.id]: e.target.value })}
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => decide(s, false)}>
                  <X className="size-4" /> Recusar
                </Button>
                <Button onClick={() => decide(s, true)}>
                  <Check className="size-4" /> Aprovar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Histórico</h2>
        <div className="bg-card border border-border rounded-xl divide-y divide-border">
          {outras.length === 0 && <div className="p-4 text-sm text-muted-foreground">Sem registros.</div>}
          {outras.map((s) => (
            <div key={s.id} className="p-4 text-sm flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{s.nome} • {formatBR(parseYMD(s.data))}</div>
                <div className="text-muted-foreground">{s.motivo}</div>
                {s.resposta_admin && <div className="text-xs text-muted-foreground mt-1"><b>Resposta:</b> {s.resposta_admin}</div>}
              </div>
              <span className={`text-xs px-2 py-1 rounded-md ${
                s.status === "aprovada" ? "bg-available/20 text-available" : "bg-unavailable/20 text-unavailable"
              }`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}