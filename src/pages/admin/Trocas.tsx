import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight, Calendar, User, MessageSquare } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { cn } from "@/lib/utils";
import { FavoritarBotao } from "@/components/FavoritarBotao"; // <-- importação adicionada

interface Row {
  id: string;
  solicitante_id: string;
  destinatario_id: string | null;
  data_destinatario: string;
  status: string;
  mensagem: string | null;
  created_at: string;
  respondido_em: string | null;
}

export default function AdminTrocas() {
  const [rows, setRows] = useState<Row[]>([]);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [filtro, setFiltro] = useState<string>("todos");

  const load = async () => {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from("trocas_folga").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, nome"),
    ]);
    setRows((t ?? []) as Row[]);
    setNomes(new Map(((p ?? []) as { id: string; nome: string }[]).map((x) => [x.id, x.nome])));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = filtro === "todos" ? rows : rows.filter((r) => r.status === filtro);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-primary" /> Histórico de Trocas Inteligentes
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe as permutas temporárias entre colaboradores.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovada">Aprovadas</option>
            <option value="recusada">Recusadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
          <FavoritarBotao rota="/admin/trocas" label="Trocas" icone="ArrowLeftRight" />
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
            Nenhuma troca encontrada com este filtro.
          </div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-8 flex-1 min-w-[300px]">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <User className="size-3" /> Solicitante
                    </div>
                    <div className="font-bold">{nomes.get(r.solicitante_id) ?? "—"}</div>
                  </div>
                  
                  <ArrowLeftRight className="size-5 text-primary/40 shrink-0" />

                  <div className="space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <User className="size-3" /> Destinatário
                    </div>
                    <div className="font-bold">{r.destinatario_id ? (nomes.get(r.destinatario_id) ?? "—") : "Aguardando..."}</div>
                  </div>

                  <div className="space-y-1 ml-auto">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" /> Data da Troca
                    </div>
                    <div className="font-bold text-primary">{formatBR(parseYMD(r.data_destinatario))}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <Badge className={cn(
                      "border",
                      r.status === 'pendente' ? "bg-pending/20 text-pending-foreground border-pending/40" :
                      r.status === 'aprovada' ? "bg-available/20 text-available border-available/40" :
                      "bg-muted text-muted-foreground border-border"
                    )}>
                      {r.status}
                    </Badge>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Solicitada em {new Date(r.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </div>

              {r.mensagem && (
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex items-start gap-2">
                  <MessageSquare className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground">
                    <span className="font-bold uppercase text-[9px] block mb-0.5">Motivo informado pelo colaborador:</span>
                    "{r.mensagem}"
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}