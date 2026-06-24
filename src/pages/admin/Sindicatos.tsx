import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
  Calendar,
  Upload,
} from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import { FavoritarBotao } from "@/components/FavoritarBotao";

interface Sindicato {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: "laboral" | "patronal" | null;
  contato_whatsapp: string | null;
  created_at: string;
  updated_at: string;
}

interface DocumentoSindicato {
  id: string;
  sindicato_id: string;
  ano: number;
  tipo_documento: "act" | "cct";
  storage_path: string;
  nome_pdf: string | null;
  created_at: string;
}

const TIPOS_SINDICATO = [
  { value: "laboral", label: "Laboral" },
  { value: "patronal", label: "Patronal" },
];

const TIPOS_DOCUMENTO = [
  { value: "act", label: "ACT (Acordo Coletivo de Trabalho)" },
  { value: "cct", label: "CCT (Convenção Coletiva de Trabalho)" },
];

export default function Sindicatos() {
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Dialog de cadastro/edição
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Sindicato | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    tipo: "" as "laboral" | "patronal" | "",
    contato_whatsapp: "",
  });

  // Dialog de documentos
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [sindicatoSelecionado, setSindicatoSelecionado] = useState<Sindicato | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoSindicato[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docForm, setDocForm] = useState({
    ano: new Date().getFullYear(),
    tipo_documento: "act" as "act" | "cct",
    arquivo: null as File | null,
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Dialog de confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<Sindicato | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<DocumentoSindicato | null>(null);

  // Preview do PDF
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadSindicatos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sindicatos")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      setSindicatos(data ?? []);
    } catch (error) {
      console.error("Erro ao carregar sindicatos:", error);
      toast.error("Erro ao carregar sindicatos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSindicatos();
  }, [loadSindicatos]);

  // Carregar documentos de um sindicato
  const loadDocumentos = useCallback(async (sindicatoId: string) => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from("documentos_sindicato")
        .select("*")
        .eq("sindicato_id", sindicatoId)
        .order("ano", { ascending: false });

      if (error) throw error;
      setDocumentos(data ?? []);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  const abrirDocDialog = (sindicato: Sindicato) => {
    setSindicatoSelecionado(sindicato);
    setDocForm({
      ano: new Date().getFullYear(),
      tipo_documento: "act",
      arquivo: null,
    });
    setDocDialogOpen(true);
    loadDocumentos(sindicato.id);
  };

  // Salvar sindicato
  const salvarSindicato = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome do sindicato é obrigatório");
      return;
    }

    setBusy(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        tipo: form.tipo || null,
        contato_whatsapp: form.contato_whatsapp.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editando) {
        const { error } = await supabase
          .from("sindicatos")
          .update(dados)
          .eq("id", editando.id);
        if (error) throw error;
        toast.success("Sindicato atualizado!");
      } else {
        const { error } = await supabase.from("sindicatos").insert(dados);
        if (error) throw error;
        toast.success("Sindicato criado!");
      }

      setDialogOpen(false);
      setEditando(null);
      setForm({ nome: "", cnpj: "", tipo: "", contato_whatsapp: "" });
      loadSindicatos();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar sindicato", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Excluir sindicato
  const excluirSindicato = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      // Primeiro deleta todos os documentos do storage
      const { data: docs } = await supabase
        .from("documentos_sindicato")
        .select("storage_path")
        .eq("sindicato_id", confirmDelete.id);

      if (docs && docs.length > 0) {
        const paths = docs.map(d => d.storage_path);
        await supabase.storage.from("sindicatos").remove(paths);
      }

      const { error } = await supabase
        .from("sindicatos")
        .delete()
        .eq("id", confirmDelete.id);

      if (error) throw error;
      toast.success("Sindicato excluído!");
      setConfirmDelete(null);
      loadSindicatos();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir sindicato", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Upload de documento
  const uploadDocumento = async () => {
    if (!sindicatoSelecionado) return;
    if (!docForm.arquivo) {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    setUploadingDoc(true);
    try {
      const path = `sindicato_${sindicatoSelecionado.id}/${docForm.tipo_documento}_${docForm.ano}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("sindicatos")
        .upload(path, docForm.arquivo, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("documentos_sindicato")
        .insert({
          sindicato_id: sindicatoSelecionado.id,
          ano: docForm.ano,
          tipo_documento: docForm.tipo_documento,
          storage_path: path,
          nome_pdf: docForm.arquivo.name,
        });

      if (insertError) throw insertError;

      toast.success("Documento anexado com sucesso!");
      setDocForm({ ...docForm, arquivo: null });
      loadDocumentos(sindicatoSelecionado.id);
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao anexar documento", { description: (error as Error).message });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Excluir documento
  const excluirDocumento = async () => {
    if (!deletingDoc) return;
    try {
      const { error: storageError } = await supabase.storage
        .from("sindicatos")
        .remove([deletingDoc.storage_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("documentos_sindicato")
        .delete()
        .eq("id", deletingDoc.id);

      if (dbError) throw dbError;

      toast.success("Documento removido!");
      setDeletingDoc(null);
      if (sindicatoSelecionado) {
        loadDocumentos(sindicatoSelecionado.id);
      }
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      toast.error("Erro ao excluir documento", { description: (error as Error).message });
    }
  };

  // Download/Preview de documento
  const handleDownload = async (doc: DocumentoSindicato) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(doc.storage_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const handlePreview = async (doc: DocumentoSindicato) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(doc.storage_path, 60);

    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_SINDICATO.find(t => t.value === tipo)?.label || tipo;
  };

  const getDocTipoLabel = (tipo: string) => {
    return TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;
  };

  // Filtros (opcional)
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  const filteredSindicatos = useMemo(() => {
    return sindicatos.filter(s => {
      const matchNome = s.nome.toLowerCase().includes(filtroNome.toLowerCase());
      const matchTipo = filtroTipo === "todos" || s.tipo === filtroTipo;
      return matchNome && matchTipo;
    });
  }, [sindicatos, filtroNome, filtroTipo]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Sindicatos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sindicatos, ACTs e CCTs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/sindicatos" label="Sindicatos" icone="Building2" />
          <Button onClick={() => { setEditando(null); setForm({ nome: "", cnpj: "", tipo: "", contato_whatsapp: "" }); setDialogOpen(true); }}>
            <Plus className="size-4 mr-2" /> Novo Sindicato
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar</Label>
          <Input
            placeholder="Nome do sindicato..."
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="laboral">Laboral</SelectItem>
              <SelectItem value="patronal">Patronal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setFiltroNome(""); setFiltroTipo("todos"); }}>
          Limpar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSindicatos.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhum sindicato cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSindicatos.map((s) => (
            <Card key={s.id} className="border-border shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg truncate">{s.nome}</CardTitle>
                  <Badge variant={s.tipo === "laboral" ? "default" : "secondary"}>
                    {getTipoLabel(s.tipo || "")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.cnpj && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">CNPJ:</span> {s.cnpj}
                  </div>
                )}
                {s.contato_whatsapp && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">WhatsApp:</span> {s.contato_whatsapp}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => abrirDocDialog(s)}
                  >
                    <FileText className="size-4 mr-1" /> Documentos
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => {
                      setEditando(s);
                      setForm({
                        nome: s.nome,
                        cnpj: s.cnpj || "",
                        tipo: s.tipo || "",
                        contato_whatsapp: s.contato_whatsapp || "",
                      });
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-red-500"
                    onClick={() => setConfirmDelete(s)}
                  >
                    <Trash2 className="size-4" />
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
            <DialogTitle>{editando ? "Editar Sindicato" : "Novo Sindicato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Sindicato dos Pizzaiolos"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as "laboral" | "patronal" })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_SINDICATO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Contato WhatsApp</Label>
              <Input
                value={form.contato_whatsapp}
                onChange={(e) => setForm({ ...form, contato_whatsapp: e.target.value })}
                placeholder="(62) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarSindicato} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de documentos */}
      <Dialog open={docDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setDocDialogOpen(false);
          setSindicatoSelecionado(null);
          setDocumentos([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Documentos - {sindicatoSelecionado?.nome}
            </DialogTitle>
          </DialogHeader>

          {/* Upload de novo documento */}
          <div className="border border-dashed rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ano *</Label>
                <Input
                  type="number"
                  value={docForm.ano}
                  onChange={(e) => setDocForm({ ...docForm, ano: parseInt(e.target.value) || new Date().getFullYear() })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={docForm.tipo_documento}
                  onValueChange={(v) => setDocForm({ ...docForm, tipo_documento: v as "act" | "cct" })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Arquivo (PDF) *</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setDocForm({ ...docForm, arquivo: file });
                }}
              />
              {docForm.arquivo && (
                <p className="text-xs text-muted-foreground">
                  {docForm.arquivo.name} ({(docForm.arquivo.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
            <Button onClick={uploadDocumento} disabled={uploadingDoc}>
              {uploadingDoc ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4 mr-1" />}
              Anexar Documento
            </Button>
          </div>

          {/* Lista de documentos */}
          <div className="space-y-2">
            <h4 className="font-semibold">Documentos Anexados</h4>
            {loadingDocs ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : documentos.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                Nenhum documento anexado.
              </div>
            ) : (
              <div className="space-y-2">
                {documentos.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">{getDocTipoLabel(doc.tipo_documento)}</div>
                      <div className="text-sm text-muted-foreground">
                        {doc.ano} • {doc.nome_pdf || "PDF"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-8" title="Visualizar" onClick={() => handlePreview(doc)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="Baixar" onClick={() => handleDownload(doc)}>
                        <Download className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500" title="Excluir" onClick={() => setDeletingDoc(doc)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de sindicato */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os documentos anexados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirSindicato} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão de documento */}
      <AlertDialog open={!!deletingDoc} onOpenChange={(o) => !o && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento? A ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirDocumento} className="bg-red-600 text-white hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview do PDF */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}