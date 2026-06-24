import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Download,
  Eye,
  Building2,
  Upload,
  Check,
  Filter,
  X,
} from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface Sindicato {
  id: string;
  nome: string;
  tipo: "laboral" | "patronal" | null;
}

interface Negociacao {
  id: string;
  sindicato_patronal_id: string;
  sindicato_laboral_id: string;
  mes: number;          // 1-12
  ano: number;
  tipo_documento: "act" | "cct";
  storage_path: string;
  nome_pdf: string | null;
  created_at: string;
  updated_at: string;
}

const TIPOS_DOCUMENTO = [
  { value: "act", label: "ACT (Acordo Coletivo de Trabalho)" },
  { value: "cct", label: "CCT (Convenção Coletiva de Trabalho)" },
];

const MESES = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
];

export default function SindicatosNegociacoes() {
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // --- Filtros ---
  const [filtroPatronal, setFiltroPatronal] = useState<string>("todos");
  const [filtroLaboral, setFiltroLaboral] = useState<string>("todos");
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  // --- Dialog de cadastro/edição ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Negociacao | null>(null);
  const [form, setForm] = useState({
    sindicato_patronal_id: "none",
    sindicato_laboral_id: "none",
    mes: new Date().getMonth() + 1, // 1-12
    ano: new Date().getFullYear(),
    tipo_documento: "act" as "act" | "cct",
    arquivo: null as File | null,
  });

  // --- Preview ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedNegociacao, setSelectedNegociacao] = useState<Negociacao | null>(null);

  // --- Exclusão ---
  const [confirmDelete, setConfirmDelete] = useState<Negociacao | null>(null);

  // --- Loaders ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [negRes, sindRes] = await Promise.all([
        supabase.from("negociacoes").select("*").order("ano", { ascending: false }).order("mes", { ascending: false }),
        supabase.from("sindicatos").select("id, nome, tipo").order("nome"),
      ]);

      if (negRes.error) throw negRes.error;
      if (sindRes.error) throw sindRes.error;

      setNegociacoes(negRes.data ?? []);
      setSindicatos(sindRes.data ?? []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setForm({ ...form, arquivo: file });
  };

  const abrirEdicao = (negociacao: Negociacao) => {
    setEditando(negociacao);
    setForm({
      sindicato_patronal_id: negociacao.sindicato_patronal_id,
      sindicato_laboral_id: negociacao.sindicato_laboral_id,
      mes: negociacao.mes || 1,
      ano: negociacao.ano,
      tipo_documento: negociacao.tipo_documento,
      arquivo: null,
    });
    setDialogOpen(true);
  };

  // --- Verificação de duplicidade ---
  const verificarDuplicidade = async () => {
    // Se for edição, ignora a própria negociação
    const query = supabase
      .from("negociacoes")
      .select("id")
      .eq("sindicato_patronal_id", form.sindicato_patronal_id)
      .eq("sindicato_laboral_id", form.sindicato_laboral_id)
      .eq("mes", form.mes)
      .eq("ano", form.ano);

    if (editando) {
      query.neq("id", editando.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data && data.length > 0;
  };

  const salvarNegociacao = async () => {
    if (form.sindicato_patronal_id === "none" || form.sindicato_laboral_id === "none") {
      toast.error("Selecione os sindicatos patronal e laboral");
      return;
    }
    if (!form.arquivo && !editando) {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    setBusy(true);
    try {
      // 🔥 Verificar duplicidade
      const isDuplicado = await verificarDuplicidade();
      if (isDuplicado) {
        toast.error(
          "Já existe uma negociação cadastrada para este mesmo par de sindicatos e data base (Mês/Ano).",
          { duration: 6000 }
        );
        return;
      }

      let path = "";
      if (form.arquivo) {
        path = `negociacoes/${form.sindicato_patronal_id}_${form.sindicato_laboral_id}_${form.ano}_${form.mes}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("sindicatos")
          .upload(path, form.arquivo, { upsert: true });
        if (uploadError) throw uploadError;
      } else if (editando) {
        path = editando.storage_path;
      } else {
        throw new Error("Arquivo é obrigatório para nova negociação");
      }

      const dados = {
        sindicato_patronal_id: form.sindicato_patronal_id,
        sindicato_laboral_id: form.sindicato_laboral_id,
        mes: form.mes,
        ano: form.ano,
        tipo_documento: form.tipo_documento,
        storage_path: path,
        nome_pdf: form.arquivo ? form.arquivo.name : editando?.nome_pdf,
      };

      if (editando) {
        const { error } = await supabase
          .from("negociacoes")
          .update({ ...dados, updated_at: new Date().toISOString() })
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Negociação atualizada!");
      } else {
        const { error } = await supabase.from("negociacoes").insert(dados);
        if (error) throw error;
        toast.success("Negociação cadastrada!");
      }

      setDialogOpen(false);
      setEditando(null);
      setForm({
        sindicato_patronal_id: "none",
        sindicato_laboral_id: "none",
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        tipo_documento: "act",
        arquivo: null,
      });
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar negociação", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const excluirNegociacao = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await supabase.storage.from("sindicatos").remove([confirmDelete.storage_path]);
      const { error } = await supabase
        .from("negociacoes")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Negociação excluída!");
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir negociação");
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async (negociacao: Negociacao) => {
    setSelectedNegociacao(negociacao);
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(negociacao.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar visualização");
    }
  };

  const handleDownload = async (negociacao: Negociacao) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(negociacao.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar download");
    }
  };

  const getSindicatoNome = (id: string) => {
    if (id === "none") return "—";
    const s = sindicatos.find(s => s.id === id);
    return s ? s.nome : "—";
  };

  const getSindicatoTipo = (id: string) => {
    if (id === "none") return "";
    const s = sindicatos.find(s => s.id === id);
    return s?.tipo === "patronal" ? "Patronal" : "Laboral";
  };

  const getMesLabel = (mes: number) => {
    const m = MESES.find(m => m.value === mes);
    return m ? m.label : "—";
  };

  // --- Filtros ---
  const negociacoesFiltradas = useMemo(() => {
    return negociacoes.filter(neg => {
      const matchPatronal = filtroPatronal === "todos" || neg.sindicato_patronal_id === filtroPatronal;
      const matchLaboral = filtroLaboral === "todos" || neg.sindicato_laboral_id === filtroLaboral;
      const matchAno = filtroAno === "todos" || neg.ano === parseInt(filtroAno);
      const matchMes = filtroMes === "todos" || neg.mes === parseInt(filtroMes);
      const matchTipo = filtroTipo === "todos" || neg.tipo_documento === filtroTipo;
      return matchPatronal && matchLaboral && matchAno && matchMes && matchTipo;
    });
  }, [negociacoes, filtroPatronal, filtroLaboral, filtroAno, filtroMes, filtroTipo]);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set(negociacoes.map(n => n.ano));
    return Array.from(anos).sort((a, b) => b - a);
  }, [negociacoes]);

  const mesesDisponiveis = useMemo(() => {
    const meses = new Set(negociacoes.map(n => n.mes));
    return Array.from(meses).sort((a, b) => a - b);
  }, [negociacoes]);

  const sindicatosPatronais = sindicatos.filter(s => s.tipo === "patronal");
  const sindicatosLaborais = sindicatos.filter(s => s.tipo === "laboral");

  // --- Renderização ---
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Negociações Coletivas
          </h1>
          <p className="text-muted-foreground mt-1">
            Registre acordos entre sindicatos patronais e laborais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/sindicatos/negociacoes" label="Negociações" icone="FileText" />
          <Button onClick={() => {
            setEditando(null);
            setForm({
              sindicato_patronal_id: "none",
              sindicato_laboral_id: "none",
              mes: new Date().getMonth() + 1,
              ano: new Date().getFullYear(),
              tipo_documento: "act",
              arquivo: null,
            });
            setDialogOpen(true);
          }}>
            <Plus className="size-4 mr-2" /> Nova Negociação
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        <div className="space-y-1">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Patronal</Label>
          <Select value={filtroPatronal} onValueChange={setFiltroPatronal}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {sindicatosPatronais.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Laboral</Label>
          <Select value={filtroLaboral} onValueChange={setFiltroLaboral}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {sindicatosLaborais.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Ano Base</Label>
          <Select value={filtroAno} onValueChange={setFiltroAno}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {anosDisponiveis.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Mês Base</Label>
          <Select value={filtroMes} onValueChange={setFiltroMes}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {mesesDisponiveis.map(m => {
                const mesLabel = MESES.find(mm => mm.value === m)?.label || m;
                return <SelectItem key={m} value={String(m)}>{mesLabel}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {TIPOS_DOCUMENTO.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 self-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFiltroPatronal("todos");
              setFiltroLaboral("todos");
              setFiltroAno("todos");
              setFiltroMes("todos");
              setFiltroTipo("todos");
            }}
          >
            <X className="size-4 mr-1" /> Limpar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : negociacoesFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhuma negociação encontrada com os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-4">
          {negociacoesFiltradas.map((neg) => (
            <Card key={neg.id} className="border-border shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg truncate">
                    {getSindicatoNome(neg.sindicato_patronal_id)} / {getSindicatoNome(neg.sindicato_laboral_id)}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">
                      Data Base: {getMesLabel(neg.mes)} / {neg.ano}
                    </Badge>
                    <Badge variant="outline">
                      {TIPOS_DOCUMENTO.find(t => t.value === neg.tipo_documento)?.label || neg.tipo_documento}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground mb-3">
                  <div>
                    <span className="font-medium">Patronal:</span> {getSindicatoNome(neg.sindicato_patronal_id)}
                  </div>
                  <div>
                    <span className="font-medium">Laboral:</span> {getSindicatoNome(neg.sindicato_laboral_id)}
                  </div>
                  <div>
                    <span className="font-medium">Documento:</span> {neg.nome_pdf || "PDF"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => handlePreview(neg)}
                  >
                    <Eye className="size-4 mr-1" /> Visualizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(neg)}
                  >
                    <Download className="size-4 mr-1" /> Baixar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirEdicao(neg)}
                  >
                    <Pencil className="size-4 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setConfirmDelete(neg)}
                  >
                    <Trash2 className="size-4 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Negociação" : "Nova Negociação"}</DialogTitle>
            {editando && (
              <DialogDescription>
                Atualize os dados da negociação. Para substituir o arquivo, selecione um novo PDF.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sindicato Patronal *</Label>
              <Select
                value={form.sindicato_patronal_id}
                onValueChange={(v) => setForm({ ...form, sindicato_patronal_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sindicatosPatronais.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                  {sindicatosPatronais.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                      Nenhum sindicato patronal cadastrado
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sindicato Laboral *</Label>
              <Select
                value={form.sindicato_laboral_id}
                onValueChange={(v) => setForm({ ...form, sindicato_laboral_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {sindicatosLaborais.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                  {sindicatosLaborais.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                      Nenhum sindicato laboral cadastrado
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano Base *</Label>
                <Input
                  type="number"
                  value={form.ano}
                  onChange={(e) => setForm({ ...form, ano: parseInt(e.target.value) || new Date().getFullYear() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mês Base *</Label>
                <Select
                  value={String(form.mes)}
                  onValueChange={(v) => setForm({ ...form, mes: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES.map(m => (
                      <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo_documento}
                onValueChange={(v) => setForm({ ...form, tipo_documento: v as "act" | "cct" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{editando ? "Novo arquivo (PDF) - opcional" : "Arquivo (PDF) *"}</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
              />
              {form.arquivo && (
                <p className="text-xs text-muted-foreground">
                  {form.arquivo.name} ({(form.arquivo.size / 1024).toFixed(1)} KB)
                </p>
              )}
              {editando && !form.arquivo && (
                <p className="text-xs text-muted-foreground">
                  Mantendo o arquivo atual: {editando.nome_pdf || "PDF"}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarNegociacao} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
            <DialogDescription>
              {selectedNegociacao
                ? `${getSindicatoNome(selectedNegociacao.sindicato_patronal_id)} / ${getSindicatoNome(selectedNegociacao.sindicato_laboral_id)} - ${getMesLabel(selectedNegociacao.mes)}/${selectedNegociacao.ano}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[600px] border-0"
                title="Visualização"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            {selectedNegociacao && (
              <Button onClick={() => handleDownload(selectedNegociacao)}>
                <Download className="size-4 mr-1" /> Baixar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir negociação?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá também o arquivo PDF. Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirNegociacao} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}