import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolgaCalendar } from "@/components/FolgaCalendar";
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

  const takenByDate = useMemo(() => {
    const m = new Map<string, { userId: string; userName?: string }>();
    for (const f of folgas) m.set(f.data, { userId: f.user_id, userName: f.nome });
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
      { onConflict: "data" },
    );
    if (error) return toast.error(error.message);
    toast.success(`Limite definido: ${v} colaborador(es)`);
    setDlg(null); load();
  };

  const removeFolga = async (iso: string) => {
    const f = folgas.find((x) => x.data === iso);
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
    const { data: { user } } = await supabase.auth.getUser();
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
      { onConflict: "data" },
    );
    toast.success("Data liberada"); setDlg(null); load();
  };

  const blockDate = async (iso: string) => {
    if (!blockReason.trim()) return toast.error("Informe o motivo");
    await supabase.from("datas_bloqueadas").upsert(
      { data: iso, motivo: blockReason.trim(), liberada: false, auto: false },
      { onConflict: "data" },
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
        takenByDate={takenByDate} manualBlocked={manualMap}
        dayLimits={dayLimits}
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
              {dlg.status === "taken" || dlg.status === "mine" ? (
                <div className="space-y-3">
                  <div className="text-sm">
                    Folga de <b>{takenByDate.get(dlg.iso)?.userName}</b>.
                  </div>
                  <Button variant="destructive" onClick={() => removeFolga(dlg.iso)}>Remover folga</Button>
                </div>
              ) : dlg.status === "blocked" ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">{manualMap.get(dlg.iso)?.reason}</div>
                  <Button onClick={() => liberateDate(dlg.iso)}>Liberar esta data</Button>
                </div>
              ) : dlg.status === "available" ? (
                <div className="space-y-4">
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
                      onChange={(e) => setEditBlockReason(e.target.value)}
                      placeholder="Motivo do bloqueio"
                    />
                    <Button variant="destructive" className="w-full" onClick={() => blockDate(dlg.iso)}>
                      Bloquear data
                    </Button>
                  </div>
                </div>
              ) : (
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