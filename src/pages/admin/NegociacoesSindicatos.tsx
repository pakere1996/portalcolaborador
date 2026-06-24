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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Trash2,
  FileText,
  Download,
  Eye,
  Building2,
  Upload,
  Pencil,
} from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { formatBR } from "@/lib/folga-rules";

// --- Interfaces ---
interface Sindicato {
  id: string;
  nome: string;
  tipo: "laboral" | "patronal" | null;
}

interface Negociacao {
  id: string;
  patronal_id: string;
  laboral_id: string;
  ano: number;
  tipo_documento: "act" | "cct";
  storage_path: string;
  nome_pdf: string | null;
  created_at: string;
  updated_at: string;
  patronal_nome?: string;
  laboral_nome?: string;
}

const TIPOS_DOCUMENTO = [
  { value: "act", label: "ACT (Acordo Coletivo de Trabalho)" },
  { value: "cct", label: "CCT (Convenção Coletiva de Trabalho)" },
];

export default function NegociacoesSindicatos() {
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);
  const [negociacoes, setNegociacoes] = useState<Negociacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // --- Filtros ---
  const [filtroPatronal, setFiltroPatronal] = useState("");
  const [filtroLaboral, setFiltroLaboral] = useState("");

  // --- Diálogo de upload ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    patronal_id: "",
    laboral_id: "",
    ano: new Date().getFullYear(),
    tipo_documento: "act" as "act" | "cct",
    arquivo: null as File | null,
  });
  const [uploading, setUploading] = useState(false);

  // --- Diálogo de edição ---
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Negociacao | null>(null);
  const [editForm, setEditForm] = useState({
    ano: new Date().getFullYear(),
    tipo_documento: "act" as "act" | "cct",
  });

  // --- Exclusão ---
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Negociacao | null>(null);

  // --- Preview ---
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // --- Loaders ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Carregar sindicatos
      const { data: sindData, error: sindError } = await supabase
        .from("sindicatos")
        .select("id, nome, tipo")
        .order("nome", { ascending: true });
      if (sindError) throw sindError;
      setSindicatos(sindData ?? []);

      // Carregar negociações com nomes dos sindicatos
      const { data: negData, error: negError } = await supabase
        .from("negociacoes")
        .select(`
          *,
          patronal:sindicatos!negociacoes_patronal_id_fkey (nome),
          laboral:sindicatos!negociacoes_laboral_id_fkey (nome)
        `)
        .order("ano", { ascending: false });
      if (negError) throw negError;

      const negMapped = (negData ?? []).map((item: any) => ({
        ...item,
        patronal_nome: item.patronal?.nome || "Removido",
        laboral_nome: item.laboral?.nome || "Removido",
      }));
      setNegociacoes(negMapped);
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

  // --- Filtrar sindicatos por tipo ---
  const patronais = sindicatos.filter(s => s.tipo === "patronal");
  const laborais = sindicatos.filter(s => s.tipo === "laboral");

  // --- Filtrar negociações ---
  const negociacoesFiltradas = useMemo(() => {
    return negociacoes.filter(n => {
      const matchPatronal = !filtroPatronal || n.patronal_id === filtroPatronal;
      const matchLaboral = !filtroLaboral || n.laboral_id === filtroLaboral;
      return matchPatronal && matchLaboral;
    });
  }, [negociacoes, filtroPatronal, filtroLaboral]);

  // --- Upload ---
  const handleUpload = async () => {
    if (!form.patronal_id || !form.laboral_id || !form.arquivo || !form.ano) {
      toast.error("Preencha todos os campos");
      return;
    }

    setUploading(true);
    try {
      const path = `negociacoes/${form.patronal_id}_${form.laboral_id}_${form.ano}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("sindicatos")
        .upload(path, form.arquivo, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("negociacoes")
        .insert({
          patronal_id: form.patronal_id,
          laboral_id: form.laboral_id,
          ano: form.ano,
          tipo_documento: form.tipo_documento,
          storage_path: path,
          nome_pdf: form.arquivo.name,
        });
      if (insertError) throw insertError;

      toast.success("Negociação cadastrada!");
      setDialogOpen(false);
      setForm({
        patronal_id: "",
        laboral_id: "",
        ano: new Date().getFullYear(),
        tipo_documento: "act",
        arquivo: null,
      });
      loadData();
    } catch (error) {
      console.error("Erro ao cadastrar negociação:", error);
      toast.error("Erro ao cadastrar negociação");
    } finally {
      setUploading(false);
    }
  };

  // --- Editar ---
  const abrirEdicao = (neg: Negociacao) => {
    setEditando(neg);
    setEditForm({
      ano: neg.ano,
      tipo_documento: neg.tipo_documento,
    });
    setEditDialogOpen(true);
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    try {
      const { error } = await supabase
        .from("negociacoes")
        .update({
          ano: editForm.ano,
          tipo_documento: editForm.tipo_documento,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editando.id);
      if (error) throw error;
      toast.success("Negociação atualizada!");
      setEditDialogOpen(false);
      setEditando(null);
      loadData();
    } catch (error) {
      console.error("Erro ao editar:", error);
      toast.error("Erro ao editar negociação");
    }
  };

  // --- Excluir ---
  const confirmarExclusao = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await supabase.storage.from("sindicatos").remove([deleting.storage_path]);
      const { error } = await supabase.from("negociacoes").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success("Negociação excluída!");
      setDeleteDialogOpen(false);
      setDeleting(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir negociação");
    } finally {
      setBusy(false);
    }
  };

  // --- Download e Preview ---
  const handleDownload = async (neg: Negociacao) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(neg.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const handlePreview = async (neg: Negociacao) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(neg.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else toast.error("Erro ao gerar visualização");
  };

  // --- Helpers ---
  const getTipoLabel = (tipo: string) => TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Negociações Coletivas
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre ACT/CCT entre sindicatos patronal e laboral.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/sindicatos/negociacoes" label="Negociações" icone="FileText" />
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4 mr-2" /> Nova Negociação
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Sindicato Patronal</Label>
          <Select value={filtroPatronal} onValueChange={setFiltroPatronal}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {patronais.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Sindicato Laboral</Label>
          <Select value={filtroLaboral} onValueChange={setFiltroLaboral}>
            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {laborais.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setFiltroPatronal(""); setFiltroLaboral(""); }}>
          Limpar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="size-8 animate-spin" /></div>
      ) : negociacoesFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhuma negociação cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {negociacoesFiltradas.map(neg => (
            <Card key={neg.id} className="border-border shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg truncate">
                    {neg.patronal_nome} ↔ {neg.laboral_nome}
                  </CardTitle>
                  <Badge variant="outline">{neg.ano}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Tipo:</span> {getTipoLabel(neg.tipo_documento)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Arquivo: {neg.nome_pdf || "PDF"}
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => abrirEdicao(neg)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" title="Visualizar" onClick={() => handlePreview(neg)}>
                    <Eye className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" title="Baixar" onClick={() => handleDownload(neg)}>
                    <Download className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-500" title="Excluir" onClick={() => { setDeleting(neg); setDeleteDialogOpen(true); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Upload */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Negociação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sindicato Patronal *</Label>
              <Select value={form.patronal_id} onValueChange={(v) => setForm({ ...form, patronal_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {patronais.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sindicato Laboral *</Label>
              <Select value={form.laboral_id} onValueChange={(v) => setForm({ ...form, laboral_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {laborais.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano *</Label>
              <Input type="number" value={form.ano} onChange={e => setForm({ ...form, ano: parseInt(e.target.value) || new Date().getFullYear() })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.tipo_documento} onValueChange={(v: any) => setForm({ ...form, tipo_documento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Arquivo (PDF) *</Label>
              <Input type="file" accept=".pdf" onChange={e => setForm({ ...form, arquivo: e.target.files?.[0] || null })} />
              {form.arquivo && <p className="text-xs text-muted-foreground">{form.arquivo.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4 mr-1" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Negociação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={editForm.ano} onChange={e => setEditForm({ ...editForm, ano: parseInt(e.target.value) || new Date().getFullYear() })} />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={editForm.tipo_documento} onValueChange={(v: any) => setEditForm({ ...editForm, tipo_documento: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">O arquivo permanece o mesmo.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarEdicao}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir negociação?</AlertDialogTitle><AlertDialogDescription>Ação irreversível.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Visualização</DialogTitle></DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? <iframe src={previewUrl} className="w-full h-[600px] border-0" /> : <div className="flex items-center justify-center h-full text-muted-foreground">Carregando...</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}