import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Ban, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { MONTH_NAMES, formatBR, parseYMD } from "@/lib/folga-rules";

type Tipo = "fixa_anual" | "dinamica";
interface Regra {
  id: string;
  descricao: string;
  tipo: Tipo;
  mes: number;
  dia: number | null;
  ordinal: number | null;
  dia_semana: number | null;
  ativo: boolean;
}
interface DataBloqueada {
  id: string;
  data: string;
  motivo: string;
  auto: boolean;
  liberada: boolean;
}

const ORDINAIS = [
  { v: 1, label: "1º" },
  { v: 2, label: "2º" },
  { v: 3, label: "3º" },
  { v: 4, label: "4º" },
  { v: 5, label: "5º" },
];
const DIAS_SEMANA = [
  { v: 0, label: "Domingo" },
  { v: 1, label: "Segunda" },
  { v: 2, label: "Terça" },
  { v: 3, label: "Quarta" },
  { v: 4, label: "Quinta" },
  { v: 5, label: "Sexta" },
  { v: 6, label: "Sábado" },
];

const emptyRegra = (): Regra => ({
  id: "",
  descricao: "",
  tipo: "fixa_anual",
  mes: 1,
  dia: 1,
  ordinal: null,
  dia_semana: null,
  ativo: true,
});

export default function BloqueiosAdmin() {
  const currentYear = new Date().getFullYear();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [datas, setDatas] = useState<DataBloqueada[]>([]);
  const [loading, setLoading] = useState(true);

  const [ano, setAno] = useState<number>(currentYear);
  const [mesFiltro, setMesFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  const [dlgOpen, setDlgOpen] = useState(false);
  const [edit, setEdit] = useState<Regra>(emptyRegra());

  const load = async () => {
    setLoading(true);
    const start = `${ano}-01-01`;
    const end = `${ano}-12-31`;
    const [{ data: r, error: er }, { data: d, error: ed }] = await Promise.all([
      supabase.from("bloqueio_regras").select("*").order("mes").order("descricao"),
      supabase.from("datas_bloqueadas").select("id, data, motivo, auto, liberada").gte("data", start).lte("data", end).order("data"),
    ]);
    if (er) toast.error("Erro ao carregar regras", { description: er.message });
    if (ed) toast.error("Erro ao carregar datas", { description: ed.message });
    setRegras((r ?? []) as Regra[]);
    setDatas((d ?? []) as DataBloqueada[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ano]);

  const openNew = () => { setEdit(emptyRegra()); setDlgOpen(true); };
  const openEdit = (r: Regra) => { setEdit({ ...r }); setDlgOpen(true); };

  const saveRegra = async () => {
    if (!edit.descricao.trim()) return toast.error("Informe a descrição");
    const payload: Partial<Regra> = {
      descricao: edit.descricao.trim(),
      tipo: edit.tipo,
      mes: edit.mes,
      ativo: edit.ativo,
      dia: edit.tipo === "fixa_anual" ? edit.dia : null,
      ordinal: edit.tipo === "dinamica" ? edit.ordinal : null,
      dia_semana: edit.tipo === "dinamica" ? edit.dia_semana : null,
    };
    if (payload.tipo === "fixa_anual" && (!payload.dia || payload.dia < 1 || payload.dia > 31)) {
      return toast.error("Informe um dia válido (1-31)");
    }
    if (payload.tipo === "dinamica" && (payload.ordinal == null || payload.dia_semana == null)) {
      return toast.error("Escolha o ordinal e o dia da semana");
    }

    const { error } = edit.id
      ? await supabase.from("bloqueio_regras").update(payload).eq("id", edit.id)
      : await supabase.from("bloqueio_regras").insert(payload as Regra);

    if (error) return toast.error("Erro ao salvar", { description: error.message });
    toast.success(edit.id ? "Regra atualizada" : "Regra criada");
    setDlgOpen(false);
    await regenerar(false);
  };

  const toggleAtivo = async (r: Regra) => {
    const { error } = await supabase.from("bloqueio_regras").update({ ativo: !r.ativo }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await regenerar(false);
  };

  const removeRegra = async (r: Regra) => {
    if (!confirm(`Excluir a regra "${r.descricao}"?`)) return;
    const { error } = await supabase.from("bloqueio_regras").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Regra excluída");
    await load();
  };

  const regenerar = async (showToast = true) => {
    const { error } = await supabase.rpc("gerar_bloqueios_ano", { _ano: ano });
    if (error) {
      toast.error("Erro ao regenerar datas", { description: error.message });
      return;
    }
    if (showToast) toast.success(`Datas de ${ano} regeneradas`);
    await load();
  };

  const removeData = async (d: DataBloqueada) => {
    if (!confirm(`Remover bloqueio de ${formatBR(parseYMD(d.data))}?`)) return;
    const { error } = await supabase.from("datas_bloqueadas").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Bloqueio removido");
    await load();
  };

  const toggleLiberada = async (d: DataBloqueada) => {
    const { error } = await supabase.from("datas_bloqueadas").update({ liberada: !d.liberada }).eq("id", d.id);
    if (error) return toast.error(error.message);
    await load();
  };

  const datasFiltradas = useMemo(() => {
    return datas.filter((d) => {
      const dt = parseYMD(d.data);
      if (mesFiltro !== "todos" && dt.getMonth() !== Number(mesFiltro)) return false;
      if (tipoFiltro === "auto" && !d.auto) return false;
      if (tipoFiltro === "manual" && d.auto) return false;
      if (tipoFiltro === "liberada" && !d.liberada) return false;
      return true;
    });
  }, [datas, mesFiltro, tipoFiltro]);

  const formatRegra = (r: Regra) => {
    if (r.tipo === "fixa_anual") {
      return `${String(r.dia).padStart(2, "0")}/${String(r.mes).padStart(2, "0")} (todo ano)`;
    }
    const ord = ORDINAIS.find((o) => o.v === r.ordinal)?.label ?? "?";
    const ds = DIAS_SEMANA.find((d) => d.v === r.dia_semana)?.label ?? "?";
    return `${ord} ${ds} de ${MONTH_NAMES[r.mes - 1]}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Ban className="size-6 text-primary" /> Datas Bloqueadas
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure datas em que colaboradores não podem selecionar folgas.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => regenerar(true)} disabled={loading}>
            <RefreshCw className="size-4 mr-2" /> Regenerar {ano}
          </Button>
          <Button onClick={openNew}>
            <Plus className="size-4 mr-2" /> Nova regra
          </Button>
        </div>
      </div>

      <Tabs defaultValue="regras">
        <TabsList>
          <TabsTrigger value="regras">Regras ({regras.length})</TabsTrigger>
          <TabsTrigger value="datas">Datas geradas ({datas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-2">
          {regras.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              Nenhuma regra cadastrada. Clique em "Nova regra".
            </div>
          )}
          {regras.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="font-semibold flex items-center gap-2">
                  {r.descricao}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                    {r.tipo === "fixa_anual" ? "Fixa" : "Dinâmica"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{formatRegra(r)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Ativa</Label>
                <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeRegra(r)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="datas" className="space-y-4">
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <Label className="text-xs">Ano</Label>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mês</Label>
              <Select value={mesFiltro} onValueChange={setMesFiltro}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="auto">Automáticas</SelectItem>
                  <SelectItem value="manual">Manuais</SelectItem>
                  <SelectItem value="liberada">Liberadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {datasFiltradas.length === 0 && (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
              Nenhuma data bloqueada com esses filtros.
            </div>
          )}
          <div className="space-y-2">
            {datasFiltradas.map((d) => (
              <div key={d.id} className="rounded-xl border bg-card p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="font-semibold">{formatBR(parseYMD(d.data))}</div>
                  <div className="text-sm text-muted-foreground">{d.motivo}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                  {d.auto ? "Automática" : "Manual"}
                </span>
                {d.liberada && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    Liberada
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <Label className="text-xs">{d.liberada ? "Liberada" : "Bloqueada"}</Label>
                  <Switch checked={!d.liberada} onCheckedChange={() => toggleLiberada(d)} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeData(d)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edit.id ? "Editar regra" : "Nova regra de bloqueio"}</DialogTitle>
            <DialogDescription>
              Datas fixas repetem no mesmo dia/mês todo ano. Datas dinâmicas (ex.: Dia das Mães) são recalculadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input
                value={edit.descricao}
                onChange={(e) => setEdit({ ...edit, descricao: e.target.value })}
                placeholder="Ex.: Dia das Mães"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={edit.tipo} onValueChange={(v) => setEdit({ ...edit, tipo: v as Tipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixa_anual">Fixa (mesmo dia todo ano)</SelectItem>
                  <SelectItem value="dinamica">Dinâmica (ex.: 2º domingo de Maio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês</Label>
              <Select value={String(edit.mes)} onValueChange={(v) => setEdit({ ...edit, mes: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {edit.tipo === "fixa_anual" ? (
              <div>
                <Label>Dia</Label>
                <Input
                  type="number" min={1} max={31}
                  value={edit.dia ?? ""}
                  onChange={(e) => setEdit({ ...edit, dia: Number(e.target.value) })}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordinal</Label>
                  <Select
                    value={edit.ordinal ? String(edit.ordinal) : ""}
                    onValueChange={(v) => setEdit({ ...edit, ordinal: Number(v) })}
                  >
                    <SelectTrigger><SelectValue placeholder="1º, 2º..." /></SelectTrigger>
                    <SelectContent>
                      {ORDINAIS.map((o) => (
                        <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Dia da semana</Label>
                  <Select
                    value={edit.dia_semana != null ? String(edit.dia_semana) : ""}
                    onValueChange={(v) => setEdit({ ...edit, dia_semana: Number(v) })}
                  >
                    <SelectTrigger><SelectValue placeholder="Domingo..." /></SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((d) => (
                        <SelectItem key={d.v} value={String(d.v)}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={edit.ativo}
                onCheckedChange={(c) => setEdit({ ...edit, ativo: c })}
              />
              <Label>Regra ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancelar</Button>
            <Button onClick={saveRegra}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}