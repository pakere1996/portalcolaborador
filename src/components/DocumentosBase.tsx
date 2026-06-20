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
import { Upload, History, Download, Pencil, Loader2, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface DocumentosBaseProps {
  tipo: "contracheque" | "ponto";
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  importTitle: string;
}

export function DocumentosBase({ tipo, titulo, icone, descricao, importTitle }: DocumentosBaseProps) {
  const [aba, setAba] = useState<"importar" | "historico">("importar");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroAno, setFiltroAno] = useState("todos");
  const [editando, setEditando] = useState<string | null>(null);
  const [editMes, setEditMes] = useState("");
  const [editAno, setEditAno] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentoParaExcluir, setDocumentoParaExcluir] = useState<Documento | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");

      if (profsError) throw profsError;

      const profileMap = new Map(profs?.map(p => [p.id, p.nome]) ?? []);

      const sortedDocs = (docs ?? []).sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano;
        if (a.mes !== b.mes) return b.mes - a.mes;
        const nomeA = profileMap.get(a.colaborador_id) ?? "";
        const nomeB = profileMap.get(b.colaborador_id) ?? "";
        return nomeA.localeCompare(nomeB);
      });

      setDocumentos(sortedDocs);
      setProfiles(profs ?? []);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
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
      return true;
    });
  }, [documentos, filtroColab, filtroMes, filtroAno]);

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

  // 🔥 Função de exclusão
  const confirmDelete = useCallback((doc: Documento) => {
    setDocumentoParaExcluir(doc);
    setDeleteDialogOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!documentoParaExcluir) return;
    setDeleting(true);
    try {
      // 1. Remove o arquivo do storage
      const { error: storageError } = await supabase.storage
        .from("documentos")
        .remove([documentoParaExcluir.storage_path]);

      if (storageError) {
        console.error("Erro ao remover arquivo:", storageError);
        // Continua mesmo se falhar a remoção do storage (pode já ter sido removido)
      }

      // 2. Remove o registro do banco
      const { error: dbError } = await supabase
        .from("documentos")
        .delete()
        .eq("id", documentoParaExcluir.id);

      if (dbError) throw dbError;

      toast.success(`Documento de ${documentoParaExcluir.mes}/${documentoParaExcluir.ano} excluído com sucesso!`);
      setDeleteDialogOpen(false);
      setDocumentoParaExcluir(null);
      load(); // recarrega a lista
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      toast.error("Erro ao excluir documento", { description: (error as Error).message });
    } finally {
      setDeleting(false);
    }
  }, [documentoParaExcluir, load]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          {icone} {titulo}
        </h1>
        <p className="text-muted-foreground mt-1">{descricao}</p>
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
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3">
            <div className="space-y-1 flex-1 min-w-[180px]">
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
            <div className="space-y-1 w-[140px]">
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
            <div className="space-y-1 w-[120px]">
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
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhum documento encontrado.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Colaborador</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Competência</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden md:table-cell">Arquivo</th>
                    <th className="text-center p-4 font-bold uppercase text-[10px] text-muted-foreground">Status</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden md:table-cell">Aprovado em</th>
                    <th className="text-right p-4 font-bold uppercase text-[10px] text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((doc) => {
                    const profile = profiles.find((p) => p.id === doc.colaborador_id);
                    return (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium">{profile?.nome ?? "—"}</td>
                        <td className="p-4">
                          {editando === doc.id ? (
                            <div className="flex items-center gap-2">
                              <Select value={editMes} onValueChange={setEditMes}>
                                <SelectTrigger className="w-[100px] h-8">
                                  <SelectValue placeholder="Mês" />
                                </SelectTrigger>
                                <SelectContent>
                                  {MESES.map((m, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                className="w-[90px] h-8"
                                placeholder="Ano"
                                value={editAno}
                                onChange={(e) => setEditAno(e.target.value)}
                                maxLength={4}
                              />
                              <Button
                                size="icon"
                                className="size-8"
                                onClick={() => handleEditSave(doc.id)}
                                disabled={busy}
                              >
                                {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                onClick={cancelEditing}
                              >
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
                              title="Excluir documento"
                              onClick={() => confirmDelete(doc)}
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

      {/* 🔥 Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              {documentoParaExcluir && (
                <>
                  <p className="mb-2">
                    Você está prestes a excluir o documento de <strong>
                      {profiles.find(p => p.id === documentoParaExcluir.colaborador_id)?.nome ?? "Colaborador"}
                    </strong> referente à competência <strong>
                      {String(documentoParaExcluir.mes).padStart(2, "0")}/{documentoParaExcluir.ano}
                    </strong>.
                  </p>
                  <p className="text-destructive font-medium">
                    Esta ação é irreversível. O arquivo será removido permanentemente do sistema.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Excluindo...
                </>
              ) : (
                "Sim, excluir documento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}