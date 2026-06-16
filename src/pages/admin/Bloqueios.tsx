"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Calendar, Trash2, CalendarX, CalendarCheck, Filter } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { Tables } from "@/integrations/supabase/types";

type BloqueioRegra = Tables<'bloqueio_regras'>;
type DataBloqueada = Tables<'datas_bloqueadas'>;

export default function BloqueiosPage() {
  const [regras, setRegras] = useState<BloqueioRegra[]>([]);
  const [datasBloqueadas, setDatasBloqueadas] = useState<DataBloqueada[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const [rRes, dRes] = await Promise.all([
        supabase.from("bloqueio_regras").select("*").order("created_at", { ascending: false }),
        supabase.from("datas_bloqueadas").select("*").order("data", { ascending: true }),
      ]);
      setRegras(rRes.data ?? []);
      setDatasBloqueadas(dRes.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredDatas = datasBloqueadas.filter(d => {
    const date = parseYMD(d.data);
    const yearMatch = date.getFullYear() === anoFiltro;
    const monthMatch = mesFiltro === "all" || date.getMonth() + 1 === Number(mesFiltro);
    return yearMatch && monthMatch;
  });

  // --- Regras de Bloqueio ---
  const [regraDialog, setRegraDialog] = useState<BloqueioRegra | null>(null);
  const [regraForm, setRegraForm] = useState<Partial<BloqueioRegra>>({
    descricao: "", tipo: "fixa_anual", mes: null, dia: null, ordinal: null, dia_semana: null, ativo: true,
  });

  const openRegraDialog = (r?: BloqueioRegra) => {
    if (r) {
      setRegraDialog(r);
      setRegraForm(r);
    } else {
      setRegraDialog(null);
      setRegraForm({ descricao: "", tipo: "fixa_anual", mes: null, dia: null, ordinal: null, dia_semana: null, ativo: true });
    }
  };

  const saveRegra = async () => {
    if (!regraForm.descricao.trim()) return toast.error("Descrição é obrigatória");
    setBusy(true);
    try {
      if (regraDialog) {
        const { error } = await supabase.from("bloqueio_regras").update(regraForm).eq("id", regraDialog.id);
        if (error) throw error;
        toast.success("Regra atualizada");
      } else {
        const { error } = await supabase.from("bloqueio_regras").insert(regraForm);
        if (error) throw error;
        toast.success("Regra criada");
      }
      setRegraDialog(null);
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const deleteRegra = async (id: string) => {
    const { error } = await supabase.from("bloqueio_regras").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Regra excluída");
    load();
  };

  const gerarBloqueios = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("gerar_bloqueios_ano", { _ano: anoFiltro });
      if (error) throw error;
      toast.success(`${data} datas bloqueadas geradas para ${anoFiltro}`);
      load();
    } catch (e) {
      toast.error("Erro ao gerar bloqueios", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // --- Datas Bloqueadas Manuais ---
  const [dataDialog, setDataDialog] = useState<{ iso: string } | null>(null);
  const [manualData, setManualData] = useState("");
  const [manualMotivo, setManualMotivo] = useState("");

  const openDataDialog = (iso?: string) => {
    if (iso) {
      setDataDialog({ iso });
      setManualData(iso);
      setManualMotivo("");
    } else {
      setDataDialog(null);
      setManualData("");
      setManualMotivo("");
    }
  };

  const saveManualBlock = async () => {
    if (!manualData || !manualMotivo.trim()) return toast.error("Preencha data e motivo");
    setBusy(true);
    try {
      const { error } = await supabase.from("datas_bloqueadas").upsert({
        data: manualData,
        motivo: manualMotivo.trim(),
        auto: false,
        liberada: false,
      }, { onConflict: "data" });
      if (error) throw error;
      toast.success("Data bloqueada");
      openDataDialog();
      load();
    } catch (e) {
      toast.error("Erro ao bloquear", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const liberarData = async (id: string) => {
    const { error } = await supabase.from("datas_bloqueadas").update({ liberada: true }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Data liberada");
    load();
  };

  const deleteManualBlock = async (id: string) => {
    const { error } = await supabase.from("datas_bloqueadas").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Bloqueio removido");
    load();
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "fixa_anual": return "Fixa Anual (dia/mês)";
      case "dinamica": return "Dinâmica (ex: 2º sábado)";
      case "pos_pagamento": return "Pós-Pagamento (1º sáb após dia 5)";
      default: return tipo;
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CalendarX className="size-6 text-primary" /> Datas Bloqueadas
          </h1>
          <p className="text-muted-foreground mt-1">Configure regras automáticas e bloqueios manuais de folgas.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={gerarBloqueios} disabled={busy} variant="outline">
            <Calendar className="size-4 mr-2" /> Gerar Bloqueios do Ano ({anoFiltro})
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Ano</Label>
          <Input type="number" value={anoFiltro} onChange={(e) => setAnoFiltro(Number(e.target.value))} className="w-[120px]" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Mês</Label>
          <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[180px]">
            <option value="all">Todos os meses</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Regras de Bloqueio Automático */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="size-5 text-primary" /> Regras de Bloqueio Automático
          </h2>
          <Dialog open={!!regraDialog} onOpenChange={(o) => !o && openRegraDialog()}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Nova Regra</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{regraDialog ? "Editar Regra" : "Nova Regra"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Descrição *</Label>
                  <Input value={regraForm.descricao} onChange={(e) => setRegraForm({ ...regraForm, descricao: e.target.value })} placeholder="Ex: Natal, Black Friday..." />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <select value={regraForm.tipo} onChange={(e) => setRegraForm({ ...regraForm, tipo: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="fixa_anual">Fixa Anual (dia/mês fixo)</option>
                    <option value="dinamica">Dinâmica (ex: 2º sábado do mês)</option>
                    <option value="pos_pagamento">Pós-Pagamento (1º sáb após dia 5)</option>
                  </select>
                </div>
                {regraForm.tipo === "fixa_anual" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Mês (1-12) *</Label><Input type="number" min={1} max={12} value={regraForm.mes ?? ""} onChange={(e) => setRegraForm({ ...regraForm, mes: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Dia (1-31) *</Label><Input type="number" min={1} max={31} value={regraForm.dia ?? ""} onChange={(e) => setRegraForm({ ...regraForm, dia: Number(e.target.value) })} /></div>
                  </div>
                )}
                {regraForm.tipo === "dinamica" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Mês (1-12) *</Label><Input type="number" min={1} max={12} value={regraForm.mes ?? ""} onChange={(e) => setRegraForm({ ...regraForm, mes: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Dia da Semana (0=Dom...6=Sáb) *</Label><Input type="number" min={0} max={6} value={regraForm.dia_semana ?? ""} onChange={(e) => setRegraForm({ ...regraForm, dia_semana: Number(e.target.value) })} /></div>
                    <div className="space-y-2"><Label>Ordinal (1=primeiro, 2=segundo...) *</Label><Input type="number" min={1} max={5} value={regraForm.ordinal ?? ""} onChange={(e) => setRegraForm({ ...regraForm, ordinal: Number(e.target.value) })} /></div>
                  </div>
                )}
                {regraForm.tipo === "pos_pagamento" && (
                  <div className="space-y-2"><Label>Mês (1-12) *</Label><Input type="number" min={1} max={12} value={regraForm.mes ?? ""} onChange={(e) => setRegraForm({ ...regraForm, mes: Number(e.target.value) })} /></div>
                )}
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="ativo" checked={regraForm.ativo} onChange={(e) => setRegraForm({ ...regraForm, ativo: e.target.checked })} className="size-4" />
                  <Label htmlFor="ativo">Ativa</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => openRegraDialog()}>Cancelar</Button>
                <Button onClick={saveRegra} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {regras.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma regra configurada.</div>
          ) : (
            <div className="divide-y divide-border">
              {regras.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/20">
                  <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${r.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <CalendarCheck className="size-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{r.descricao}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{getTipoLabel(r.tipo)}</span>
                        {r.tipo === "fixa_anual" && <span>Dia {r.dia}/{String(r.mes).padStart(2, '0')}</span>}
                        {r.tipo === "dinamica" && <span>{r.ordinal}º dia {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][r.dia_semana ?? 0]} do mês {r.mes}</span>}
                        {r.tipo === "pos_pagamento" && <span>1º Sábado após dia 5 do mês {r.mes}</span>}
                        {!r.ativo && <span className="text-red-500 font-medium">Inativa</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openRegraDialog(r)}><Filter className="size-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir esta regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A regra será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRegra(r.id)} className="bg-red-600 text-white hover:bg-red-700">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bloqueios Manuais */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarX className="size-5 text-rose-500" /> Bloqueios Manuais / Liberações
          </h2>
          <Dialog open={!!dataDialog} onOpenChange={(o) => !o && openDataDialog()}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Bloquear Data</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Bloquear Data Manualmente</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Data *</Label><Input type="date" value={manualData} onChange={(e) => setManualData(e.target.value)} /></div>
                <div className="space-y-2"><Label>Motivo *</Label><Input value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} placeholder="Ex: Evento da empresa, manutenção..." /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => openDataDialog()}>Cancelar</Button>
                <Button onClick={saveManualBlock} disabled={busy}>{busy ? "Salvando..." : "Bloquear"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {filteredDatas.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma data bloqueada neste período.</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredDatas.map((d) => (
                <div key={d.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/20">
                  <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${d.liberada ? "bg-emerald-100 text-emerald-600" : d.auto ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
                      {d.liberada ? <CalendarCheck className="size-5" /> : <CalendarX className="size-5" />}
                    </div>
                    <div>
                      <div className="font-semibold">{formatBR(parseYMD(d.data))}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4">
                        <span>{d.motivo}</span>
                        <Badge variant="outline" className={d.auto ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-rose-50 text-rose-700 border-rose-200"}>
                          {d.auto ? "Automático" : "Manual"}
                        </Badge>
                        <Badge variant="outline" className={d.liberada ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}>
                          {d.liberada ? "Liberada" : "Bloqueada"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!d.liberada && !d.auto && (
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => { if(confirm("Excluir este bloqueio manual?")) deleteManualBlock(d.id); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                    {!d.liberada && (
                      <Button variant="outline" size="sm" className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" onClick={() => liberarData(d.id)}>
                        <CalendarCheck className="size-4 mr-1" /> Liberar
                      </Button>
                    )}
                    {d.liberada && (
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Liberada</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}