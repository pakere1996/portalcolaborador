import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FolgaCalendar, type DayOccupant } from "@/components/FolgaCalendar";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar as CalIcon } from "lucide-react";
import { dayType, formatBR, monthKey, parseYMD } from "@/lib/folga-rules";

export default function AdminCalendar() {
  const { user } = useAuth();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth());
  const [folgas, setFolgas] = useState<{ id: string; user_id: string; data: string; nome?: string }[]>([]);
  const [manual, setManual] = useState<{ id: string; data: string; motivo: string; liberada: boolean }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; nome: string }[]>([]);
  const [limites, setLimites] = useState<{ data: string; limite_colaboradores: number }[]>([]);
  const [dlg, setDlg] = useState<{ iso: string; status: string } | null>(null);
  const [assignUser, setAssignUser] = useState<string>("");
  const [blockReason, setBlockReason] = useState("");
  const [limitInput, setLimitInput] = useState<number>(1);

  const load = async () => {
    const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month0 + 1, 0);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
    const [{ data: f }, { data: b }, { data: p }, { data: lim }] = await Promise.all([
      supabase.from("folgas").select("id, user_id, data").gte("data", start).lte("data", end),
      supabase.from("datas_bloqueadas").select("id, data, motivo, liberada").gte("data", start).lte("data", end),
      supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("dia_config").select("data, limite_colaboradores").gte("data", start).lte("data", end),
    ]);
    const profs = (p ?? []) as { id: string; nome: string }[];
    setProfiles(profs);
    const nm = new Map(profs.map((x) => [x.id, x.nome]));
    setFolgas((f ?? []).map((x) => ({ ...x, nome: nm.get(x.user_id) })));
    setManual((b ?? []) as typeof manual);
    setLimites((lim ?? []) as typeof limites);
  };

  useEffect(() => { load(); }, [year, month0]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-calendario-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folgas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datas_bloqueadas" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dia_config" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [year, month0]);

  const occupantsByDate = useMemo(() => {
    const m = new Map<string, DayOccupant[]>();
    for (const f of folgas) {
      const arr = m.get(f.data) ?? [];
      arr.push({ userId: f.user_id, userName: f.nome });
      m.set(f.data, arr);
    }
    return m;
  }, [folgas]);

  const manualMap = useMemo(() => {
    const m = new Map<string, { reason: string; liberada: boolean }>();
    for (const b of manual) m.set(b.data, { reason: b.motivo, liberada: b.liberada });
    return m;
  }, [manual]);

  const dayLimits = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of limites) m.set(l.data, l.limite_colaboradores);
    return m;
  }, [limites]);

  const onSelect = (iso: string, info: { status: string }) => {
    setDlg({ iso, status: info.status });
    setAssignUser("");
    setBlockReason("");
    setLimitInput(dayLimits.get(iso) ?? 1);
  };

  const salvarLimite = async (iso: string) => {
    const v = Math.max(1, Math.min(10, Math.floor(limitInput)));
    const { error } = await supabase.from("dia_config").upsert(
      { data: iso, limite_colaboradores: v },
      { onConflict: "data" }
    );
    if (error) return toast.error(error.message);
    toast.success(`Limite definido: ${v} colaborador(es)`);
    setDlg(null); load();
  };

  const removeFolga = async (iso: string, userId: string) => {
    const f = folgas.find((x) => x.data === iso && x.user_id === userId);
    if (!f) return;
    const { error } = await supabase.from("folgas").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Folga removida");
    setDlg(null); load();
  };

  const assignFolga = async (iso: string) => {
    if (!assignUser) return toast.error("Escolha um funcionário");
    const d = parseYMD(iso);
    const tipo = dayType(d);
    if (!tipo) return toast.error("Apenas sábado ou domingo");
    const { error } = await supabase.from("folgas").insert({
      user_id: assignUser, data: iso, mes: monthKey(d), tipo, criado_por: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Folga atribuída");
    setDlg(null); load();
  };

  const liberateDate = async (iso: string) => {
    await supabase.from("datas_bloqueadas").upsert(
      { data: iso, motivo: "Liberada manualmente", liberada: true, auto: false },
      { onConflict: "data" }
    );
    toast.success("Data liberada"); setDlg(null); load();
  };

  const blockDate = async (iso: string) => {
    if (!blockReason.trim()) return toast.error("Informe o motivo");
    await supabase.from("datas_bloqueadas").upsert(
      { data: iso, motivo: blockReason.trim(), liberada: false, auto: false },
      { onConflict: "data" }
    );
    toast.success("Data bloqueada"); setDlg(null); load();
  };

  const goPrev = () => { const d = new Date(year, month0 - 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };
  const goNext = () => { const d = new Date(year, month0 + 1, 1); setYear(d.getFullYear()); setMonth0(d.getMonth()); };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <CalIcon className="size-6 text-primary" /> Calendário Geral
        </h1>
        <p className="text-muted-foreground mt-1">Edite folgas, libere ou bloqueie datas manualmente.</p>
      </div>

      <FolgaCalendar
        year={year} month0={month0}
        occupantsByDate={occupantsByDate} manualBlocked={manualMap}
        dayLimits={dayLimits}
        myUserId={user?.id ?? null}
        onPrev={goPrev} onNext={goNext}
        onSelectDay={onSelect}
        locked={null}
      />

      <Dialog open={!!dlg} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dlg && formatBR(parseYMD(dlg.iso))} — ações
            </DialogTitle>
          </DialogHeader>

          {dlg && (
            <div className="space-y-4">
              {(dlg.status === "taken" || dlg.status === "mine" || occupantsByDate.get(dlg.iso)?.length) ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium mb-2">Colaboradores com folga:</div>
                  <div className="space-y-2">
                    {occupantsByDate.get(dlg.iso)?.map((occ) => (
                      <div key={occ.userId} className="flex items-center justify-between bg-muted/30 p-2 rounded-lg">
                        <span className="text-sm">{occ.userName}</span>
                        <Button variant="destructive" size="sm" onClick={() => removeFolga(dlg.iso, occ.userId)}>Remover</Button>
                      </div>
                    ))}
                    {!occupantsByDate.get(dlg.iso)?.length && <div className="text-xs text-muted-foreground">Ninguém escalado.</div>}
                  </div>
                </div>
              ) : null}

              {dlg.status === "blocked" ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">{manualMap.get(dlg.iso)?.reason}</div>
                  <Button onClick={() => liberateDate(dlg.iso)}>Liberar esta data</Button>
                </div>
              ) : (
                <div className="space-y-4 border-t border-border pt-4">
                  <div className="space-y-2">
                    <Label>Atribuir folga a:</Label>
                    <select
                      className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                      value={assignUser}
                      onChange={(e) => setAssignUser(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {profiles.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <Button className="w-full" onClick={() => assignFolga(dlg.iso)}>Atribuir folga</Button>
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <Label>Limite de colaboradores neste dia</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number" min={1} max={10}
                        value={limitInput}
                        onChange={(e) => setLimitInput(Number(e.target.value) || 1)}
                      />
                      <Button onClick={() => salvarLimite(dlg.iso)}>Salvar</Button>
                    </div>
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <Label>Ou bloquear esta data:</Label>
                    <Input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Motivo do bloqueio"
                    />
                    <Button variant="destructive" className="w-full" onClick={() => blockDate(dlg.iso)}>
                      Bloquear data
                    </Button>
                  </div>
                </div>
              )}
              
              {dlg.status === "past" && (
                <div className="text-sm text-muted-foreground">Data passada — sem ações.</div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlg(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}