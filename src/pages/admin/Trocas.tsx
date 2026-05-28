import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ArrowLeftRight } from "lucide-react";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Row {
  id: string;
  solicitante_id: string;
  destinatario_id: string;
  dia_original: number;
  dia_solicitado: number;
  status: string;
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
    const ch = supabase
      .channel("admin-trocas")
      .on("postgres_changes", { event: "*", schema: "public", table: "trocas_folga" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = filtro === "todos" ? rows : rows.filter((r) => r.status === filtro);

  const badge = (s: string) => {
    const map: Record<string, string> = {
      pendente: "bg-pending/20 text-pending-foreground border-pending/40",
      aprovada: "bg-available/20 text-available border-available/40",
      recusada: "bg-unavailable/20 text-unavailable border-unavailable/40",
      cancelada: "bg-muted text-muted-foreground border-border",
    };
    return <Badge className={`${map[s] ?? ""} border`}>{s}</Badge>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-primary" /> Histórico de Trocas
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe todas as trocas entre colaboradores.</p>
        </div>
        <select
          className="bg-input border border-border rounded-md px-3 py-2 text-sm"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovada">Aprovadas</option>
          <option value="recusada">Recusadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma troca encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 px-2">Solicitante</th>
                  <th className="py-2 px-2">Destinatário</th>
                  <th className="py-2 px-2">Troca</th>
                  <th className="py-2 px-2">Status</th>
                  <th className="py-2 px-2">Solicitada</th>
                  <th className="py-2 px-2">Respondida</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 px-2">{nomes.get(r.solicitante_id) ?? "?"}</td>
                    <td className="py-2 px-2">{nomes.get(r.destinatario_id) ?? "?"}</td>
                    <td className="py-2 px-2">{DIAS[r.dia_original]} ⇄ {DIAS[r.dia_solicitado]}</td>
                    <td className="py-2 px-2">{badge(r.status)}</td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {r.respondido_em ? new Date(r.respondido_em).toLocaleString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}