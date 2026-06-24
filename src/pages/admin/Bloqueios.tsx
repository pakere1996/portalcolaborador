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
import { Plus, Calendar, Trash2, CalendarX, CalendarCheck, Filter, Building2, Check, Eye, EyeOff } from "lucide-react";
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

interface DataBloqueadaComUnidade extends DataBloqueada {
  unidade?: Unidade;
}

const MESES = [1,2,3,4,5,6,7,8,9,10,11,12];
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function BloqueiosPage() {
  const [regras, setRegras] = useState<RegraComUnidades[]>([]);
  const [datasBloqueadas, setDatasBloqueadas] = useState<DataBloqueadaComUnidade[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  
  // Filtros
  const [anoFiltro, setAnoFiltro] = useState(new Date().getFullYear());
  const [mesFiltro, setMesFiltro] = useState<string>("all");
  const [aplicacaoFiltro, setAplicacaoFiltro] = useState<string>("all");
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>("all");
  const [showPast, setShowPast] = useState(false);

  const [isRegraDialogOpen, setIsRegraDialogOpen] = useState(false);
  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);

  // --- Função para reprocessar bloqueios (gerar próximos 12 meses) ---
  const reprocessarBloqueios = async () => {
    if (reprocessando) return;
    setReprocessando(true);
    try {
      const { data, error } = await supabase.rpc("gerar_bloqueios_proximos_meses");
      if (error) throw error;
      console.log(`${data} datas bloqueadas geradas`);
      toast.success(`${data} datas bloqueadas geradas com sucesso`);
    } catch (e) {
      console.error("Erro ao reprocessar bloqueios:", e);
      toast.error("Erro ao gerar bloqueios automáticos", { description: (e as Error).message });
    } finally {
      setReprocessando(false);
    }
  };

  // --- Carregar dados ---
  const load = async () => {
    setLoading(true);
    try {
      const { data: unidadesData } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      setUnidades(unidadesData ?? []);

      const { data: regrasData, error: regrasError } = await supabase
        .from("bloqueio_regras")
        .select("*")
        .order("created_at", { ascending: false });
      if (regrasError) throw regrasError;

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

      const { data: datasData, error: datasError } = await supabase
        .from("datas_bloqueadas")
        .select(`
          *,
          unidade:unidades(id, nome)
        `)
        .order("data", { ascending: true });
      if (datasError) throw datasError;
      setDatasBloqueadas(datasData ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  // --- Inicialização: carregar e depois reprocessar se necessário ---
  useEffect(() => {
    const inicializar = async () => {
      await load();
      // Verificar se há datas futuras. Se não houver, gerar automaticamente.
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const temFuturas = datasBloqueadas.some(d => parseYMD(d.data) >= hoje);
      if (!temFuturas && !reprocessando && !loading) {
        await reprocessarBloqueios();
        await load();
      }
    };
    inicializar();
  }, []);

  // --- Filtro de datas ---
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredDatas = datasBloqueadas.filter(d => {
    const date = parseYMD(d.data);
    const yearMatch = date.getFullYear() === anoFiltro;
    const monthMatch = mesFiltro === "all" || date.getMonth() + 1 === Number(mesFiltro);
    const dateMatch = showPast ? true : date >= today;
    const unidadeMatch = unidadeFiltro === "all" || d.unidade_id === unidadeFiltro;
    return yearMatch && monthMatch && dateMatch && unidadeMatch;
  });

  // --- Filtro de regras por aplicação ---
  const filteredRegras = regras.filter(r => {
    if (aplicacaoFiltro === "all") return true;
    return r.aplicacao === aplicacaoFiltro;
  });

  // --- Estado do formulário de regras ---
  const [regraForm, setRegraForm] = useState<Partial<BloqueioRegra>>({
    descricao: "",
    tipo: "fixa_anual",
    aplicacao: "anual",
    ano_referencia: null,
    meses: [],
    dias: [],
    ordinal: null,
    dia_semana: null,
    ativo: true,
  });
  const [regraUnidadesSelecionadas, setRegraUnidadesSelecionadas] = useState<string[]>([]);
  const [editRegraId, setEditRegraId] = useState<string | null>(null);

  // --- Estado do formulário de data manual ---
  const [manualData, setManualData] = useState("");
  const [manualMotivo, setManualMotivo] = useState("");
  const [manualUnidadeId, setManualUnidadeId] = useState<string>("");
  const [editDataId, setEditDataId] = useState<string | null>(null);

  // Helpers
  const toggleArrayItem = (array: number[], item: number) =>
    array.includes(item) ? array.filter(i => i !== item) : [...array, item];

  const toggleAllMeses = () => {
    const all = MESES;
    setRegraForm(prev => ({
      ...prev,
      meses: prev.meses?.length === all.length ? [] : all,
    }));
  };

  const toggleAllDias = () => {
    const all = DIAS;
    setRegraForm(prev => ({
      ...prev,
      dias: prev.dias?.length === all.length ? [] : all,
    }));
  };

  // --- Diálogo de Regras ---
  const openRegraDialog = async (r?: RegraComUnidades) => {
    if (r) {
      setEditRegraId(r.id);
      setRegraForm({
        descricao: r.descricao || "",
        tipo: r.tipo || "fixa_anual",
        aplicacao: r.aplicacao || "anual",
        ano_referencia: r.ano_referencia || null,
        meses: r.meses || [],
        dias: r.dias || [],
        ordinal: r.ordinal || null,
        dia_semana: r.dia_semana || null,
        ativo: r.ativo ?? true,
      });
      const { data: vincData } = await supabase
        .from("bloqueio_regra_unidades")
        .select("unidade_id")
        .eq("regra_id", r.id);
      setRegraUnidadesSelecionadas(vincData?.map(v => v.unidade_id) ?? []);
    } else {
      setEditRegraId(null);
      setRegraForm({
        descricao: "",
        tipo: "fixa_anual",
        aplicacao: "anual",
        ano_referencia: null,
        meses: [],
        dias: [],
        ordinal: null,
        dia_semana: null,
        ativo: true,
      });
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
      prev.includes(unidadeId) ? prev.filter(id => id !== unidadeId) : [...prev, unidadeId]
    );
  };

  const saveRegra = async () => {
    if (!regraForm.descricao?.trim()) return toast.error("Descrição é obrigatória");
    if (regraForm.aplicacao === "unica" && !regraForm.ano_referencia) {
      toast.error("Para regras únicas, informe o ano de referência.");
      return;
    }
    if (!regraForm.meses || regraForm.meses.length === 0) {
      toast.error("Selecione pelo menos um mês.");
      return;
    }
    if (regraForm.tipo === "fixa_anual" && (!regraForm.dias || regraForm.dias.length === 0)) {
      toast.error("Selecione pelo menos um dia.");
      return;
    }

    setBusy(true);
    try {
      let regraId = editRegraId;

      const dadosParaEnviar = {
        descricao: regraForm.descricao.trim(),
        tipo: regraForm.tipo,
        aplicacao: regraForm.aplicacao,
        ano_referencia: regraForm.aplicacao === "unica" ? regraForm.ano_referencia : null,
        meses: regraForm.meses,
        dias: regraForm.tipo === "fixa_anual" ? regraForm.dias : null,
        ordinal: regraForm.tipo === "dinamica" ? regraForm.ordinal : null,
        dia_semana: regraForm.tipo === "dinamica" ? regraForm.dia_semana : null,
        mes: regraForm.meses.length === 1 ? regraForm.meses[0] : null,
        dia: regraForm.tipo === "fixa_anual" && regraForm.dias && regraForm.dias.length === 1 ? regraForm.dias[0] : null,
        ativo: regraForm.ativo,
        updated_at: new Date().toISOString(),
      };

      if (editRegraId) {
        const { error } = await supabase
          .from("bloqueio_regras")
          .update(dadosParaEnviar)
          .eq("id", editRegraId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("bloqueio_regras")
          .insert({ ...dadosParaEnviar, created_at: new Date().toISOString() })
          .select("id")
          .single();
        if (error) throw error;
        regraId = data.id;
      }

      if (regraId) {
        await supabase.from("bloqueio_regra_unidades").delete().eq("regra_id", regraId);
        if (regraUnidadesSelecionadas.length > 0) {
          const inserts = regraUnidadesSelecionadas.map(unidade_id => ({
            regra_id: regraId,
            unidade_id,
          }));
          const { error } = await supabase.from("bloqueio_regra_unidades").insert(inserts);
          if (error) throw error;
        }
      }

      toast.success(editRegraId ? "Regra atualizada" : "Regra criada");
      closeRegraDialog();
      await reprocessarBloqueios();
      await load();
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
    await reprocessarBloqueios();
    await load();
  };

  // --- Diálogo de Data Manual ---
  const openDataDialog = (data?: DataBloqueadaComUnidade) => {
    if (data) {
      setEditDataId(data.id);
      setManualData(data.data);
      setManualMotivo(data.motivo || "");
      setManualUnidadeId(data.unidade_id || "");
    } else {
      setEditDataId(null);
      setManualData("");
      setManualMotivo("");
      setManualUnidadeId("");
    }
    setIsDataDialogOpen(true);
  };

  const closeDataDialog = () => {
    setIsDataDialogOpen(false);
    setEditDataId(null);
    setManualData("");
    setManualMotivo("");
    setManualUnidadeId("");
  };

  const saveManualBlock = async () => {
    if (!manualData) return toast.error("Selecione uma data");
    if (!manualMotivo.trim()) return toast.error("Informe o motivo");
    setBusy(true);
    try {
      const payload = {
        data: manualData,
        motivo: manualMotivo.trim(),
        auto: false,
        liberada: false,
        unidade_id: manualUnidadeId || null,
      };

      if (editDataId) {
        const { error } = await supabase
          .from("datas_bloqueadas")
          .update(payload)
          .eq("id", editDataId);
        if (error) throw error;
        toast.success("Bloqueio atualizado");
      } else {
        const { error } = await supabase
          .from("datas_bloqueadas")
          .upsert(payload, { onConflict: "data,unidade_id" });
        if (error) throw error;
        toast.success("Data bloqueada");
      }
      closeDataDialog();
      await load();
    } catch (e) {
      toast.error("Erro ao salvar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const liberarData = async (id: string) => {
    const { error } = await supabase
      .from("datas_bloqueadas")
      .update({ liberada: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Data liberada");
    await load();
  };

  const deleteManualBlock = async (id: string) => {
    const { error } = await supabase
      .from("datas_bloqueadas")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Bloqueio removido");
    await load();
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "fixa_anual": return "Fixa (dia/mês fixo)";
      case "dinamica": return "Dinâmica (ex: 2º sábado)";
      case "pos_pagamento": return "Pós-Pagamento (1º sáb e dom após dia 5)";
      default: return tipo;
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };

  const formatMeses = (meses: number[] | null) => {
    if (!meses || meses.length === 0) return "Todos";
    return meses.map(m => getMonthName(m)).join(", ");
  };

  const formatDias = (dias: number[] | null) => {
    if (!dias || dias.length === 0) return "Todos";
    return dias.join(", ");
  };

  // --- Renderização ---
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <CalendarX className="size-6 text-primary" /> Datas Bloqueadas
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure regras automáticas e bloqueios manuais. As alterações geram automaticamente os próximos 12 meses.
            {reprocessando && <span className="ml-2 text-amber-600">⏳ Regenerando bloqueios...</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <FavoritarBotao rota="/admin/bloqueios" label="Bloqueios" icone="CalendarX" />
          <Button onClick={() => { reprocessarBloqueios(); }} disabled={reprocessando} variant="outline">
            <Calendar className="size-4 mr-2" /> Regenerar 12 meses
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
            <option value="all">Todos</option>
            {MESES.map(m => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Aplicação</Label>
          <select value={aplicacaoFiltro} onChange={(e) => setAplicacaoFiltro(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[160px]">
            <option value="all">Todas</option>
            <option value="anual">🔄 Anual</option>
            <option value="unica">🔹 Única vez</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label>
          <select value={unidadeFiltro} onChange={(e) => setUnidadeFiltro(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[180px]">
            <option value="all">Todas</option>
            <option value="">Global</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 flex items-end">
          <Button variant="ghost" size="sm" onClick={() => setShowPast(!showPast)} className="flex items-center gap-2">
            {showPast ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {showPast ? "Ocultar passadas" : "Mostrar passadas"}
          </Button>
        </div>
      </div>

      {/* ===== SEÇÃO: REGRAS DE BLOQUEIO ===== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="size-5 text-primary" /> Regras de Bloqueio
          </h2>
          <div className="flex gap-2">
            <Button className="rounded-full px-6" onClick={() => openRegraDialog()}>
              <Plus className="size-4 mr-2" /> Nova Regra
            </Button>
            <Button variant="outline" className="rounded-full px-6" onClick={() => openDataDialog()}>
              <CalendarX className="size-4 mr-2" /> Bloquear Data
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {filteredRegras.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma regra configurada.</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredRegras.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/20">
                  <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${r.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <CalendarCheck className="size-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{r.descricao ?? ""}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{getTipoLabel(r.tipo ?? "")}</span>
                        {r.tipo === "fixa_anual" && (
                          <>
                            <span>Meses: {formatMeses(r.meses)}</span>
                            <span>Dias: {formatDias(r.dias)}</span>
                          </>
                        )}
                        {r.tipo === "dinamica" && (
                          <>
                            <span>Mês: {r.meses && r.meses.length > 0 ? getMonthName(r.meses[0]) : "?"}</span>
                            <span>{["Primeiro","Segundo","Terceiro","Quarto","Quinto"][(r.ordinal ?? 1) - 1]} {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][r.dia_semana ?? 0]}</span>
                          </>
                        )}
                        {r.tipo === "pos_pagamento" && (
                          <span>Mês: {r.meses && r.meses.length > 0 ? getMonthName(r.meses[0]) : "?"}</span>
                        )}
                        {r.aplicacao === "unica" && r.ano_referencia && (
                          <span className="text-amber-600 font-medium">🔹 Única vez - {r.ano_referencia}</span>
                        )}
                        {r.aplicacao === "anual" && (
                          <span className="text-green-600 font-medium">🔄 Anual</span>
                        )}
                        {!r.ativo && <span className="text-red-500 font-medium">Inativa</span>}
                      </div>
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

      {/* ===== SEÇÃO: PRÓXIMAS DATAS BLOQUEADAS ===== */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <CalendarX className="size-5 text-rose-500" /> Próximas Datas Bloqueadas
          <span className="text-sm font-normal text-muted-foreground">({filteredDatas.length} datas)</span>
        </h2>
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
                        {d.unidade && <Badge variant="outline">{d.unidade.nome}</Badge>}
                        {!d.unidade_id && <Badge variant="outline">Global</Badge>}
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

      {/* ===== DIALOG DE REGRAS ===== */}
      <Dialog open={isRegraDialogOpen} onOpenChange={(o) => !o && closeRegraDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRegraId ? "Editar Regra" : "Nova Regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={regraForm.descricao ?? ""}
                onChange={(e) => setRegraForm({ ...regraForm, descricao: e.target.value })}
                placeholder="Ex: Natal, Black Friday..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <select
                value={regraForm.tipo ?? "fixa_anual"}
                onChange={(e) => {
                  const tipo = e.target.value;
                  setRegraForm(prev => ({
                    ...prev,
                    tipo,
                    dias: tipo === "fixa_anual" ? prev.dias : [],
                    ordinal: tipo === "dinamica" ? prev.ordinal : null,
                    dia_semana: tipo === "dinamica" ? prev.dia_semana : null,
                  }));
                }}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="fixa_anual">Fixa (dia/mês fixo)</option>
                <option value="dinamica">Dinâmica (ex: 2º sábado)</option>
                <option value="pos_pagamento">Pós-Pagamento (1º sábado e domingo após dia 5)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Aplicação *</Label>
              <select
                value={regraForm.aplicacao ?? "anual"}
                onChange={(e) => {
                  const val = e.target.value;
                  setRegraForm({
                    ...regraForm,
                    aplicacao: val,
                    ano_referencia: val === "unica" ? new Date().getFullYear() : null,
                  });
                }}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="anual">🔄 Anual (repetir todo ano)</option>
                <option value="unica">🔹 Única vez (aplicar apenas em um ano)</option>
              </select>
            </div>
            {regraForm.aplicacao === "unica" && (
              <div className="space-y-2">
                <Label>Ano de Referência *</Label>
                <Input
                  type="number"
                  value={regraForm.ano_referencia || ""}
                  onChange={(e) => setRegraForm({ ...regraForm, ano_referencia: parseInt(e.target.value) })}
                  min={2000}
                  max={2100}
                  placeholder="Ex: 2026"
                />
              </div>
            )}

            {/* Meses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Meses *</Label>
                <Button variant="ghost" size="sm" onClick={toggleAllMeses}>
                  {regraForm.meses?.length === MESES.length ? "Desmarcar todos" : "Marcar todos"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                {MESES.map(m => (
                  <div key={m} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRegraForm(prev => ({
                        ...prev,
                        meses: toggleArrayItem(prev.meses || [], m)
                      }))}
                      className={cn(
                        "size-5 rounded border-2 flex items-center justify-center transition-all",
                        regraForm.meses?.includes(m)
                          ? "bg-primary border-primary text-white"
                          : "border-muted-foreground/30 hover:border-primary/50"
                      )}
                    >
                      {regraForm.meses?.includes(m) && <Check className="size-3" />}
                    </button>
                    <Label className="text-sm cursor-pointer">{getMonthName(m)}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Dias (apenas fixa) */}
            {regraForm.tipo === "fixa_anual" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Dias</Label>
                  <Button variant="ghost" size="sm" onClick={toggleAllDias}>
                    {regraForm.dias?.length === DIAS.length ? "Desmarcar todos" : "Marcar todos"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Selecione os dias do mês. (Se nenhum selecionado = todos os dias)</p>
                <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {DIAS.map(d => (
                    <div key={d} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setRegraForm(prev => ({
                          ...prev,
                          dias: toggleArrayItem(prev.dias || [], d)
                        }))}
                        className={cn(
                          "size-6 rounded border-2 flex items-center justify-center transition-all text-xs",
                          regraForm.dias?.includes(d)
                            ? "bg-primary border-primary text-white"
                            : "border-muted-foreground/30 hover:border-primary/50"
                        )}
                      >
                        {regraForm.dias?.includes(d) ? <Check className="size-3" /> : d}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dinâmica */}
            {regraForm.tipo === "dinamica" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Dia da Semana *</Label>
                  <select
                    value={regraForm.dia_semana ?? ""}
                    onChange={(e) => setRegraForm({ ...regraForm, dia_semana: parseInt(e.target.value) })}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecione</option>
                    <option value="0">Domingo</option>
                    <option value="1">Segunda</option>
                    <option value="2">Terça</option>
                    <option value="3">Quarta</option>
                    <option value="4">Quinta</option>
                    <option value="5">Sexta</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Ordinal *</Label>
                  <select
                    value={regraForm.ordinal ?? ""}
                    onChange={(e) => setRegraForm({ ...regraForm, ordinal: parseInt(e.target.value) })}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
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

            {/* Unidades */}
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
              <input
                type="checkbox"
                id="ativo"
                checked={regraForm.ativo ?? true}
                onChange={(e) => setRegraForm({ ...regraForm, ativo: e.target.checked })}
                className="size-4"
              />
              <Label htmlFor="ativo">Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeRegraDialog}>Cancelar</Button>
            <Button onClick={saveRegra} disabled={busy || reprocessando}>
              {busy ? "Salvando..." : reprocessando ? "Regenerando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG DE DATA MANUAL ===== */}
      <Dialog open={isDataDialogOpen} onOpenChange={(o) => !o && closeDataDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDataId ? "Editar Bloqueio Manual" : "Bloquear Data Específica"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={manualData}
                onChange={(e) => setManualData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Input
                value={manualMotivo}
                onChange={(e) => setManualMotivo(e.target.value)}
                placeholder="Ex: Evento da empresa, manutenção..."
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade (opcional)</Label>
              <select
                value={manualUnidadeId}
                onChange={(e) => setManualUnidadeId(e.target.value)}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Global (todas as unidades)</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Selecione uma unidade específica ou mantenha "Global".</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDataDialog}>Cancelar</Button>
            <Button onClick={saveManualBlock} disabled={busy}>
              {busy ? "Salvando..." : editDataId ? "Atualizar" : "Bloquear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}