import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentImportForm } from "@/components/DocumentImportForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, History, Download, Pencil, Loader2, Check, X, Trash2, ChevronRight, Eye } from "lucide-react";
import { toast } from "sonner";
import { FavoritarBotao } from "@/components/FavoritarBotao"; // <-- importação adicionada

interface Documento {
  id: string;
  colaborador_id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string;
  status: string;
  nome_pdf: string | null;
  created_at: string;
  aprovado_em?: string | null;
}

interface Profile {
  id: string;
  nome: string;
  ativo: boolean;
  unidade_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DocumentosBaseProps {
  tipo: "contracheque" | "ponto" | "adiantamento";
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  importTitle: string;
  favorito?: { rota: string; label: string; icone: string }; // <-- nova prop opcional
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

export function DocumentosBase({ 
  tipo, 
  titulo, 
  icone, 
  descricao, 
  importTitle,
  favorito // <-- nova prop
}: DocumentosBaseProps) {
  const [aba, setAba] = useState<"importar" | "historico">("importar");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);

  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroAno, setFiltroAno] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todos");

  const [editando, setEditando] = useState<string | null>(null);
  const [editMes, setEditMes] = useState("");
  const [editAno, setEditAno] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 🔥 Estado para pré-visualização
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [excluirDialogOpen, setExcluirDialogOpen] = useState(false);
  const [documentoParaExcluir, setDocumentoParaExcluir] = useState<Documento | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const isMobile = useMediaQuery('(max-width: 768px)');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: docs, error: docsError } = await supabase
        .from("documentos")
        .select("*")
        .eq("tipo", tipo);

      if (docsError) throw docsError;

      const { data: profs, error: profsError } = await supabase
        .from("profiles")
        .select("id, nome, ativo, unidade_id")
        .order("nome");

      if (profsError) throw profsError;

      const { data: units, error: unitsError } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");

      if (unitsError) throw unitsError;

      const profileMap = new Map(profs?.map(p => [p.id, p]) ?? []);
      const unitMap = new Map(units?.map(u => [u.id, u.nome]) ?? []);

      const sortedDocs = (docs ?? []).sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        if (a.mes !== b.mes) return b.mes - a.mes;
        const nomeA = profileMap.get(a.colaborador_id)?.nome ?? "";
        const nomeB = profileMap.get(b.colaborador_id)?.nome ?? "";
        return nomeA.localeCompare(nomeB);
      });

      setDocumentos(sortedDocs);
      setProfiles(profs ?? []);
      setUnidades(units ?? []);
    } catch (error) {
      console.error("Erro ao carregar:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  }, [tipo]);

  useEffect(() => {
    load();
  }, [load]);

  const anos = useMemo(
    () => [...new Set(documentos.map((d) => d.ano))].sort((a, b) => b - a),
    [documentos]
  );

  const filtrados = useMemo(() => {
    return documentos.filter((d) => {
      if (filtroColab !== "todos" && d.colaborador_id !== filtroColab) return false;
      if (filtroMes !== "todos" && d.mes !== parseInt(filtroMes)) return false;
      if (filtroAno !== "todos" && d.ano !== parseInt(filtroAno)) return false;
      const profile = profiles.find(p => p.id === d.colaborador_id);
      if (!profile) return false;
      if (filtroStatus === "ativo" && !profile.ativo) return false;
      if (filtroStatus === "inativo" && profile.ativo) return false;
      if (filtroUnidade !== "todos" && profile.unidade_id !== filtroUnidade) return false;
      return true;
    });
  }, [documentos, profiles, filtroColab, filtroMes, filtroAno, filtroStatus, filtroUnidade]);

  const handleDownload = useCallback(async (doc: Documento) => {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  }, []);

  // 🔥 Função de pré-visualização (igual à do colaborador)
  const handlePreview = useCallback(async (doc: Documento) => {
    setSelectedDoc(doc);
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  }, []);

  const handleEditSave = useCallback(
    async (id: string) => {
      if (!editMes || !editAno) return toast.error("Mês e ano são obrigatórios");
      setBusy(true);
      const { error } = await supabase
        .from("documentos")
        .update({ mes: parseInt(editMes), ano: parseInt(editAno) })
        .eq("id", id);
      if (error) {
        toast.error("Erro ao atualizar", { description: error.message });
      } else {
        toast.success("Competência atualizada!");
        setEditando(null);
        setIsDetailOpen(false);
        load();
      }
      setBusy(false);
    },
    [editMes, editAno, load]
  );

  const startEditing = useCallback((doc: Documento) => {
    setEditando(doc.id);
    setEditMes(String(doc.mes));
    setEditAno(String(doc.ano));
  }, []);

  const cancelEditing = useCallback(() => {
    setEditando(null);
  }, []);

  const openDetail = useCallback((doc: Documento) => {
    setSelectedDoc(doc);
    setIsDetailOpen(true);
  }, []);

  const handleExcluir = useCallback((doc: Documento) => {
    setDocumentoParaExcluir(doc);
    setExcluirDialogOpen(true);
  }, []);

  const confirmarExclusao = useCallback(async () => {
    if (!documentoParaExcluir) return;
    setExcluindo(true);
    try {
      const { error: storageError } = await supabase.storage
        .from("documentos")
        .remove([documentoParaExcluir.storage_path]);

      if (storageError) console.warn("Erro ao remover arquivo:", storageError);

      const { error: dbError } = await supabase
        .from("documentos")
        .delete()
        .eq("id", documentoParaExcluir.id);

      if (dbError) throw dbError;

      toast.success("Documento excluído com sucesso!");
      setExcluirDialogOpen(false);
      setDocumentoParaExcluir(null);
      setIsDetailOpen(false);
      load();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir", { description: (error as Error).message });
    } finally {
      setExcluindo(false);
    }
  }, [documentoParaExcluir, load]);

  const getTipoLabel = (tipo: string) => {
    if (tipo === "contracheque") return "Contracheque";
    if (tipo === "ponto") return "Folha de Ponto";
    return tipo;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 🔥 Cabeçalho com botão favoritar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            {icone} {titulo}
          </h1>
          <p className="text-muted-foreground mt-1">{descricao}</p>
        </div>
        {favorito && (
          <FavoritarBotao 
            rota={favorito.rota} 
            label={favorito.label} 
            icone={favorito.icone} 
          />
        )}
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setAba("importar")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === "importar"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="size-4" /> Importar
        </button>
        <button
          onClick={() => { setAba("historico"); load(); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === "historico"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="size-4" /> Histórico
        </button>
      </div>

      {aba === "importar" && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5 text-primary" /> {importTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentImportForm />
          </CardContent>
        </Card>
      )}

      {aba === "historico" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Colaborador</Label>
              <Select value={filtroColab} onValueChange={setFiltroColab}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {MESES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Unidade</Label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhum documento encontrado com os filtros selecionados.
            </div>
          ) : isMobile ? (
            <div className="grid gap-3">
              {filtrados.map((doc) => {
                const profile = profiles.find((p) => p.id === doc.colaborador_id);
                const unidade = profile?.unidade_id ? unidades.find(u => u.id === profile.unidade_id) : null;
                const isEditing = editando === doc.id;
                return (
                  <div
                    key={doc.id}
                    className="bg-card border border-border rounded-2xl p-4 space-y-2 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0" onClick={() => openDetail(doc)}>
                        <div className="font-semibold text-sm truncate">{profile?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {unidade?.nome && <span>{unidade.nome} • </span>}
                          {String(doc.mes).padStart(2, "0")}/{doc.ano}
                        </div>
                        <Badge
                          className={
                            doc.status === "disponivel" || doc.status === "vinculado"
                              ? "bg-green-100 text-green-700 border-green-200 mt-1"
                              : "bg-muted text-muted-foreground mt-1"
                          }
                        >
                          {doc.status}
                        </Badge>
                        {!profile?.ativo && (
                          <Badge variant="outline" className="ml-1 text-[10px] bg-red-50 text-red-600 border-red-200 mt-1">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {/* 🔥 Botão Visualizar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Visualizar"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(doc);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Baixar"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(doc);
                          }}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Detalhes"
                          onClick={() => openDetail(doc)}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={editMes} onValueChange={setEditMes}>
                          <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="Mês" /></SelectTrigger>
                          <SelectContent>
                            {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input
                          className="w-[90px] h-8"
                          placeholder="Ano"
                          value={editAno}
                          onChange={(e) => setEditAno(e.target.value)}
                          maxLength={4}
                        />
                        <Button size="icon" className="size-8" onClick={() => handleEditSave(doc.id)} disabled={busy}>
                          {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={cancelEditing}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Colaborador</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Competência</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden md:table-cell">Arquivo</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden lg:table-cell">Unidade</th>
                    <th className="text-center p-4 font-bold uppercase text-[10px] text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden md:table-cell">Aprovado em</th>
                    <th className="text-right p-4 font-bold uppercase text-[10px] text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((doc) => {
                    const profile = profiles.find((p) => p.id === doc.colaborador_id);
                    const unidade = profile?.unidade_id ? unidades.find(u => u.id === profile.unidade_id) : null;
                    return (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium">
                          {profile?.nome ?? "—"}
                          {!profile?.ativo && (
                            <Badge variant="outline" className="ml-2 text-xs bg-red-50 text-red-600 border-red-200">
                              Inativo
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {editando === doc.id ? (
                            <div className="flex items-center gap-2">
                              <Select value={editMes} onValueChange={setEditMes}>
                                <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="Mês" /></SelectTrigger>
                                <SelectContent>
                                  {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input className="w-[90px] h-8" placeholder="Ano" value={editAno} onChange={(e) => setEditAno(e.target.value)} maxLength={4} />
                              <Button size="icon" className="size-8" onClick={() => handleEditSave(doc.id)} disabled={busy}>
                                {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="size-8" onClick={cancelEditing}>
                                <X className="size-3" />
                              </Button>
                            </div>
                          ) : (
                            <span className="font-mono">{String(doc.mes).padStart(2, "0")}/{doc.ano}</span>
                          )}
                        </td>
                        <td className="p-4 hidden md:table-cell text-muted-foreground text-xs truncate max-w-[200px]">
                          {doc.nome_pdf ?? "—"}
                        </td>
                        <td className="p-4 hidden lg:table-cell text-muted-foreground">
                          {unidade?.nome ?? "—"}
                        </td>
                        <td className="p-4 text-center">
                          <Badge
                            className={
                              doc.status === "disponivel" || doc.status === "vinculado"
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="p-4 hidden md:table-cell text-xs text-muted-foreground">
                          {doc.aprovado_em
                            ? new Date(doc.aprovado_em).toLocaleDateString("pt-BR") +
                              " às " +
                              new Date(doc.aprovado_em).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            {/* 🔥 Botão Visualizar */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              title="Visualizar"
                              onClick={() => handlePreview(doc)}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Editar competência"
                              onClick={() => startEditing(doc)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              title="Baixar"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              title="Excluir"
                              onClick={() => handleExcluir(doc)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 🔥 Dialog de visualização (igual ao do colaborador) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
            <DialogDescription>
              {selectedDoc
                ? `${getTipoLabel(selectedDoc.tipo)} - ${String(selectedDoc.mes).padStart(2, "0")}/${selectedDoc.ano}`
                : "Documento"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[600px] border-0"
                title="Visualização do documento"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando visualização...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (selectedDoc) handleDownload(selectedDoc);
              }}
            >
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={(o) => !o && setIsDetailOpen(false)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Documento</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Colaborador</div>
                <div className="font-medium">{profiles.find(p => p.id === selectedDoc.colaborador_id)?.nome ?? "—"}</div>
                
                <div className="text-muted-foreground">Competência</div>
                <div className="font-medium">{String(selectedDoc.mes).padStart(2, "0")}/{selectedDoc.ano}</div>
                
                <div className="text-muted-foreground">Unidade</div>
                <div className="font-medium">
                  {profiles.find(p => p.id === selectedDoc.colaborador_id)?.unidade_id 
                    ? unidades.find(u => u.id === profiles.find(p => p.id === selectedDoc.colaborador_id)?.unidade_id)?.nome 
                    : "—"}
                </div>
                
                <div className="text-muted-foreground">Status</div>
                <div>
                  <Badge
                    className={
                      selectedDoc.status === "disponivel" || selectedDoc.status === "vinculado"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {selectedDoc.status}
                  </Badge>
                </div>

                <div className="text-muted-foreground">Arquivo</div>
                <div className="font-medium truncate">{selectedDoc.nome_pdf ?? "—"}</div>

                <div className="text-muted-foreground">Aprovado em</div>
                <div className="font-medium">
                  {selectedDoc.aprovado_em
                    ? new Date(selectedDoc.aprovado_em).toLocaleDateString("pt-BR") +
                      " " +
                      new Date(selectedDoc.aprovado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (selectedDoc) handlePreview(selectedDoc);
                  }}
                >
                  <Eye className="size-4 mr-1" /> Visualizar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    if (selectedDoc) handleDownload(selectedDoc);
                    setIsDetailOpen(false);
                  }}
                >
                  <Download className="size-4 mr-1" /> Baixar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditando(selectedDoc.id);
                    setEditMes(String(selectedDoc.mes));
                    setEditAno(String(selectedDoc.ano));
                    setIsDetailOpen(false);
                  }}
                >
                  <Pencil className="size-4 mr-1" /> Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    handleExcluir(selectedDoc);
                    setIsDetailOpen(false);
                  }}
                >
                  <Trash2 className="size-4 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={excluirDialogOpen} onOpenChange={setExcluirDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento?
              <br /><br />
              <strong>Colaborador:</strong> {profiles.find(p => p.id === documentoParaExcluir?.colaborador_id)?.nome ?? "—"}
              <br />
              <strong>Competência:</strong> {documentoParaExcluir ? `${String(documentoParaExcluir.mes).padStart(2, "0")}/${documentoParaExcluir.ano}` : ""}
              <br /><br />
              Esta ação <strong>não pode ser desfeita</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={excluindo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              {excluindo ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}