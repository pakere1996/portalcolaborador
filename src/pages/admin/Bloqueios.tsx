"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Calendar, Trash2, CalendarX, CalendarCheck, Filter, Building2, Check } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { Tables } from "@/integrations/supabase/types";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { cn } from "@/lib/utils";

type BloqueioRegra = Tables<'bloqueio_regras'>;
type DataBloqueada = Tables<'datas_bloqueadas'>;
type Unidade = { id: string; nome: string };

interface RegraComUnidades extends BloqueioRegra {
  unidades?: Unidade[];
}

export default function BloqueiosPage() {
  const [regras, setRegras] = useState<RegraComUnidades[]>([]);
  const [datasBloqueadas, setDatasBloqueadas] = useState<DataBloqueada[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState<string>("all");

  // Controle de diálogos
  const [isRegraDialogOpen, setIsRegraDialogOpen] = useState(false);
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Carregar unidades ativas
      const { data: unidadesData } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      setUnidades(unidadesData ?? []);

      // Carregar regras com seus vínculos de unidades
      const { data: regrasData, error: regrasError } = await supabase
        .from("bloqueio_regras")
        .select("*")
        .order("created_at", { ascending: false });
      if (regrasError) throw regrasError;

      // Para cada regra, buscar suas unidades
      const regrasComUnidades = await Promise.all(
        (regrasData ?? []).map(async (regra) => {
          const { data: vincData } = await supabase
            .from("bloqueio_regra_unidades")
            .select("unidade_id")
            .eq("regra_id", regra.id);
          const unidadeIds = vincData?.map(v => v.unidade_id) ?? [];
          const unidadesVinculadas = unidadesData?.filter(u => unidadeIds.includes(u.id)) ?? [];
          return {
            ...regra,
            unidades: unidadesVinculadas,
          };
        })
      );
      setRegras(regrasComUnidades);

      // Carregar datas bloqueadas
      const { data: datasData, error: datasError } = await supabase
        .from("datas_bloqueadas")
        .select("*")
        .order("data", { ascending: true });
      if (datasError) throw datasError;
      setDatasBloqueadas(datasData ?? []);

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
  const [regraForm, setRegraForm] = useState<Partial<BloqueioRegra>>({
    descricao: "", tipo: "fixa_anual", mes: null, dia: null, ordinal: null, dia_semana: null, ativo: true,
  });
  const [regraUnidadesSelecionadas, setRegraUnidadesSelecionadas] = useState<string[]>([]);
  const [editRegraId, setEditRegraId] = useState<string | null>(null);

  const openRegraDialog = async (r?: RegraComUnidades) => {
    if (r) {
      setEditRegraId(r.id);
      setRegraForm({ ...r });
      // Carregar unidades vinculadas
      const { data: vincData } = await supabase
        .from("bloqueio_regra_unidades")
        .select("unidade_id")
        .eq("regra_id", r.id);
      setRegraUnidadesSelecionadas(vincData?.map(v => v.unidade_id) ?? []);
    } else {
      setEditRegraId(null);
      setRegraForm({ descricao: "", tipo: "fixa_anual", mes: null, dia: null, ordinal: null, dia_semana: null, ativo: true });
      setRegraUnidadesSelecionadas([]);
    }
    setIsRegraDialogOpen(true);
  };

  const closeRegraDialog = () => {
    setIsRegraDialogOpen(false);
    setEditRegraId(null);
    setRegraUnidadesSelecionadas([]);
  };

  const toggleUnidade = (unidadeId: string) => {
    setRegraUnidadesSelecionadas(prev =>
      prev.includes(unidadeId)
        ? prev.filter(id => id !== unidadeId)
        : [...prev, unidadeId]
    );
  };

  const saveRegra = async () => {
    if (!regraForm.descricao?.trim()) return toast.error("Descrição é obrigatória");
    setBusy(true);
    try {
      let regraId = editRegraId;

      if (editRegraId) {
        // Atualizar regra
        const { error } = await supabase
          .from("bloqueio_regras")
          .update(regraForm)
          .eq("id", editRegraId);
        if (error) throw error;
      } else {
        // Criar nova regra
        const { data, error } = await supabase
          .from("bloqueio_regras")
          .insert(regraForm)
          .select("id")
          .single();
        if (error) throw error;
        regraId = data.id;
      }

      // Atualizar vínculos com unidades (deleta todos e insere os selecionados)
      if (regraId) {
        await supabase
          .from("bloqueio_regra_unidades")
          .delete()
          .eq("regra_id", regraId);

        if (regraUnidadesSelecionadas.length > 0) {
          const inserts = regraUnidadesSelecionadas.map(unidade_id => ({
            regra_id: regraId,
            unidade_id,
          }));
          const { error } = await supabase
            .from("bloqueio_regra_unidades")
            .insert(inserts);
          if (error) throw error;
        }
      }

      toast.success(editRegraId ? "Regra atualizada" : "Regra criada");
      closeRegraDialog();
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const deleteRegra = async (id: string) => {
    // Os vínculos serão deletados em cascata (ON DELETE CASCADE)
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
  const [manualData, setManualData] = useState("");
  const [manualMotivo, setManualMotivo] = useState("");
  const [editDataId, setEditDataId] = useState<string | null>(null);

  const openDataDialog = (data?: DataBloqueada) => {
    if (data) {
      setEditDataId(data.id);
      setManualData(data.data);
      setManualMotivo(data.motivo || "");
    } else {
      setEditDataId(null);
      setManualData("");
      setManualMotivo("");
    }
    setIsDataDialogOpen(true);
  };

  const closeDataDialog = () => {
    setIsDataDialogOpen(false);
    setEditDataId(null);
  };

  const saveManualBlock = async () => {
    if (!manualData || !manualMotivo.trim()) return toast.error("Preencha data e motivo");
    setBusy(true);
    try {
      if (editDataId) {
        const { error } = await supabase.from("datas_bloqueadas").update({
          motivo: manualMotivo.trim(),
        }).eq("id", editDataId);
        if (error) throw error;
        toast.success("Bloqueio atualizado");
      } else {
        const { error } = await supabase.from("datas_bloqueadas").upsert({
          data: manualData,
          motivo: manualMotivo.trim(),
          auto: false,
          liberada: false,
        }, { onConflict: "data" });
        if (error) throw error;
        toast.success("Data bloqueada");
      }
      closeDataDialog();
      load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
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
      case "pos_pagamento": return "Pós-Pagamento (1º sáb e dom após dia 5)";
      default: return tipo;
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };

  // --- Renderização ---
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
          <FavoritarBotao rota="/admin/bloqueios" label="Bloqueios" icone="CalendarX" />
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
              <option key={m} value={m}>{getMonthName(m)}</option>
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
          <Button className="rounded-full px-6" onClick={() => openRegraDialog()}>
            <Plus className="size-4 mr-2" /> Nova Regra
          </Button>
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
                      <div className="font-semibold">{r.descricao ?? ""}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{getTipoLabel(r.tipo ?? "")}</span>
                        {r.tipo === "fixa_anual" && <span>Dia {r.dia} de {getMonthName(r.mes ?? 1)}</span>}
                        {r.tipo === "dinamica" && <span>{["Primeiro","Segundo","Terceiro","Quarto","Quinto"][(r.ordinal ?? 1) - 1]} {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][r.dia_semana ?? 0]} de {getMonthName(r.mes ?? 1)}</span>}
                        {r.tipo === "pos_pagamento" && <span>1º Sábado após dia 5 de {getMonthName(r.mes ?? 1)}</span>}
                        {!r.ativo && <span className="text-red-500 font-medium">Inativa</span>}
                      </div>
                      {/* Exibir unidades vinculadas */}
                      {r.unidades && r.unidades.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Building2 className="size-3 text-muted-foreground" />
                          {r.unidades.map(u => (
                            <Badge key={u.id} variant="outline" className="text-xs">{u.nome}</Badge>
                          ))}
                        </div>
                      )}
                      {r.unidades && r.unidades.length === 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <Badge variant="secondary" className="text-xs">Global (todas as unidades)</Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openRegraDialog(r)}>
                      <Filter className="size-4" />
                    </Button>
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

      {/* Bloqueios Manuais / Liberações */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarX className="size-5 text-rose-500" /> Bloqueios Manuais / Liberações
          </h2>
          <Button className="rounded-full px-6" onClick={() => openDataDialog()}>
            <Plus className="size-4 mr-2" /> Bloquear Data
          </Button>
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
                      <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                        <span>{d.motivo ?? ""}</span>
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
                    {!d.auto && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openDataDialog(d)}>
                        <Filter className="size-4" />
                      </Button>
                    )}
                    {!d.liberada && !d.auto && (
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => deleteManualBlock(d.id)}>
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

      {/* Dialog de Regras */}
      <Dialog open={isRegraDialogOpen} onOpenChange={(o) => !o && closeRegraDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRegraId ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={regraForm.descricao ?? ""} onChange={(e) => setRegraForm({ ...regraForm, descricao: e.target.value })} placeholder="Ex: Natal, Black Friday..." />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <select value={regraForm.tipo ?? "fixa_anual"} onChange={(e) => setRegraForm({ ...regraForm, tipo: e.target.value })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="fixa_anual">Fixa Anual (dia/mês fixo)</option>
                <option value="dinamica">Dinâmica (ex: 2º sábado do mês)</option>
                <option value="pos_pagamento">Pós-Pagamento (1º sáb após dia 5)</option>
              </select>
            </div>
            {regraForm.tipo === "fixa_anual" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mês *</Label>
                  <select value={regraForm.mes ?? ""} onChange={(e) => setRegraForm({ ...regraForm, mes: Number(e.target.value) })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecione</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{getMonthName(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Dia (1-31) *</Label>
                  <Input type="number" min={1} max={31} value={regraForm.dia ?? ""} onChange={(e) => setRegraForm({ ...regraForm, dia: Number(e.target.value) })} />
                </div>
              </div>
            )}
            {regraForm.tipo === "dinamica" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mês *</Label>
                  <select value={regraForm.mes ?? ""} onChange={(e) => setRegraForm({ ...regraForm, mes: Number(e.target.value) })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecione</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{getMonthName(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Dia da Semana *</Label>
                  <select value={regraForm.dia_semana ?? ""} onChange={(e) => setRegraForm({ ...regraForm, dia_semana: Number(e.target.value) })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecione</option>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda-feira</option>
                    <option value="2">Terça-feira</option>
                    <option value="3">Quarta-feira</option>
                    <option value="4">Quinta-feira</option>
                    <option value="5">Sexta-feira</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Ordinal *</Label>
                  <select value={regraForm.ordinal ?? ""} onChange={(e) => setRegraForm({ ...regraForm, ordinal: Number(e.target.value) })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">Selecione</option>
                    <option value="1">Primeiro</option>
                    <option value="2">Segundo</option>
                    <option value="3">Terceiro</option>
                    <option value="4">Quarto</option>
                    <option value="5">Quinto</option>
                  </select>
                </div>
              </div>
            )}
            {regraForm.tipo === "pos_pagamento" && (
              <div className="space-y-2">
                <Label>Mês *</Label>
                <select value={regraForm.mes ?? ""} onChange={(e) => setRegraForm({ ...regraForm, mes: Number(e.target.value) })} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="">Selecione</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{getMonthName(m)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Seleção de Unidades */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Unidades (opcional)</Label>
              <p className="text-sm text-muted-foreground">
                Se nenhuma unidade for selecionada, a regra será aplicada a <strong>todas</strong> as unidades.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                {unidades.map((un) => (
                  <div key={un.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleUnidade(un.id)}
                      className={cn(
                        "size-5 rounded border-2 flex items-center justify-center transition-all",
                        regraUnidadesSelecionadas.includes(un.id)
                          ? "bg-primary border-primary text-white"
                          : "border-muted-foreground/30 hover:border-primary/50"
                      )}
                    >
                      {regraUnidadesSelecionadas.includes(un.id) && <Check className="size-3" />}
                    </button>
                    <Label className="text-sm cursor-pointer">{un.nome}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="ativo" checked={regraForm.ativo ?? true} onChange={(e) => setRegraForm({ ...regraForm, ativo: e.target.checked })} className="size-4" />
              <Label htmlFor="ativo">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeRegraDialog}>Cancelar</Button>
            <Button onClick={saveRegra} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Datas Manuais */}
      <Dialog open={isDataDialogOpen} onOpenChange={(o) => !o && closeDataDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDataId ? "Editar Bloqueio" : "Bloquear Data Manualmente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Data *</Label><Input type="date" value={manualData} onChange={(e) => setManualData(e.target.value)} /></div>
            <div className="space-y-2"><Label>Motivo *</Label><Input value={manualMotivo} onChange={(e) => setManualMotivo(e.target.value)} placeholder="Ex: Evento da empresa, manutenção..." /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDataDialog}>Cancelar</Button>
            <Button onClick={saveManualBlock} disabled={busy}>{busy ? "Salvando..." : editDataId ? "Atualizar" : "Bloquear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}