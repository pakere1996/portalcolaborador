import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  FileText,
  Eye,
  Download,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface DocumentoUnificado {
  id: string;
  tipo: "contracheque" | "adiantamento" | "ponto" | "atestado" | "disciplinar";
  colaborador_id: string;
  colaborador_nome: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  mes: number | null;
  ano: number | null;
  data: string;
  status: string;
  observacao: string | null;
  storage_path: string | null;
  nome_pdf: string | null;
  created_at: string;
  // Campos extras para tipos específicos
  dias_afastamento?: number | null;
  observacao_admin?: string | null;
  tipo_disciplinar?: string | null;
  // Para edição de documentos
  acaoSeDuplicado?: string | null;
}

interface Profile {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

const MESES = [
  { value: "todos", label: "Todos" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const TIPOS_DOCUMENTO = [
  { value: "todos", label: "Todos" },
  { value: "contracheque", label: "Contracheque" },
  { value: "adiantamento", label: "Adiantamento" },
  { value: "ponto", label: "Folha de Ponto" },
  { value: "atestado", label: "Atestado" },
  { value: "disciplinar", label: "Registro Disciplinar" },
];

const STATUS_OPTS = [
  { value: "todos", label: "Todos" },
  { value: "disponivel", label: "Disponível" },
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
];

export default function DocumentosHistoricoCompleto() {
  const { user } = useAuth();
  const [documentos, setDocumentos] = useState<DocumentoUnificado[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todos");
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroAno, setFiltroAno] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");

  // Estado para pré-visualização
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentoUnificado | null>(null);

  // Estado para edição
  const [editOpen, setEditOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentoUnificado | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Estado para exclusão
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<DocumentoUnificado | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar perfis e unidades primeiro para mapeamento
      const [profilesRes, unidadesRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, unidade_id").eq("ativo", true).order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (unidadesRes.error) throw unidadesRes.error;

      const profilesData = profilesRes.data ?? [];
      const unidadesData = unidadesRes.data ?? [];
      setProfiles(profilesData);
      setUnidades(unidadesData);

      const profileMap = new Map(profilesData.map(p => [p.id, p]));
      const unidadeMap = new Map(unidadesData.map(u => [u.id, u.nome]));

      // Buscar documentos (contracheque, adiantamento, ponto)
      const { data: docsData, error: docsError } = await supabase
        .from("documentos")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (docsError) throw docsError;

      // Buscar atestados
      const { data: atestadosData, error: atestadosError } = await supabase
        .from("atestados")
        .select("*")
        .order("created_at", { ascending: false });

      if (atestadosError) throw atestadosError;

      // Buscar registros disciplinares
      const { data: disciplinaresData, error: disciplinaresError } = await supabase
        .from("registros_disciplinares")
        .select("*")
        .order("created_at", { ascending: false });

      if (disciplinaresError) throw disciplinaresError;

      // Mapear documentos
      const docsMapeados: DocumentoUnificado[] = (docsData ?? []).map((doc) => {
        const profile = profileMap.get(doc.colaborador_id);
        return {
          id: doc.id,
          tipo: doc.tipo as "contracheque" | "adiantamento" | "ponto",
          colaborador_id: doc.colaborador_id,
          colaborador_nome: profile?.nome ?? "Colaborador removido",
          unidade_id: profile?.unidade_id ?? null,
          unidade_nome: profile?.unidade_id ? unidadeMap.get(profile.unidade_id) ?? null : null,
          mes: doc.mes,
          ano: doc.ano,
          data: `${doc.ano}-${String(doc.mes).padStart(2, "0")}-01`,
          status: doc.status || "disponivel",
          observacao: null,
          storage_path: doc.storage_path,
          nome_pdf: doc.nome_pdf,
          created_at: doc.created_at,
          dias_afastamento: null,
          observacao_admin: null,
          tipo_disciplinar: null,
        };
      });

      // Mapear atestados
      const atestadosMapeados: DocumentoUnificado[] = (atestadosData ?? []).map((a) => {
        const profile = profileMap.get(a.colaborador_id);
        const dataAtestado = a.data_atestado || a.created_at.split("T")[0];
        const [ano, mes] = dataAtestado.split("-").map(Number);
        return {
          id: a.id,
          tipo: "atestado",
          colaborador_id: a.colaborador_id,
          colaborador_nome: profile?.nome ?? "Colaborador removido",
          unidade_id: profile?.unidade_id ?? null,
          unidade_nome: profile?.unidade_id ? unidadeMap.get(profile.unidade_id) ?? null : null,
          mes: mes,
          ano: ano,
          data: dataAtestado,
          status: a.status || "pendente",
          observacao: a.observacao || null,
          storage_path: a.storage_path || null,
          nome_pdf: a.nome_pdf || null,
          created_at: a.created_at,
          dias_afastamento: a.dias_afastamento || null,
          observacao_admin: a.observacao_admin || null,
          tipo_disciplinar: null,
        };
      });

      // Mapear disciplinares
      const disciplinaresMapeados: DocumentoUnificado[] = (disciplinaresData ?? []).map((d) => {
        const profile = profileMap.get(d.colaborador_id);
        const dataDoc = d.data || d.created_at.split("T")[0];
        const [ano, mes] = dataDoc.split("-").map(Number);
        return {
          id: d.id,
          tipo: "disciplinar",
          colaborador_id: d.colaborador_id,
          colaborador_nome: profile?.nome ?? "Colaborador removido",
          unidade_id: profile?.unidade_id ?? null,
          unidade_nome: profile?.unidade_id ? unidadeMap.get(profile.unidade_id) ?? null : null,
          mes: mes,
          ano: ano,
          data: dataDoc,
          status: d.tipo || "outro",
          observacao: d.observacao || null,
          storage_path: d.storage_path || null,
          nome_pdf: d.nome_pdf || null,
          created_at: d.created_at,
          dias_afastamento: d.dias_afastamento || null,
          observacao_admin: null,
          tipo_disciplinar: d.tipo || "outro",
        };
      });

      const todos = [...docsMapeados, ...atestadosMapeados, ...disciplinaresMapeados];
      todos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDocumentos(todos);
    } catch (error) {
      console.error("Erro ao carregar histórico completo:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtros
  const filtrados = useMemo(() => {
    return documentos.filter((doc) => {
      if (filtroTipo !== "todos" && doc.tipo !== filtroTipo) return false;
      if (filtroUnidade !== "todos" && doc.unidade_id !== filtroUnidade) return false;
      if (filtroColab !== "todos" && doc.colaborador_id !== filtroColab) return false;
      if (filtroMes !== "todos" && doc.mes !== parseInt(filtroMes)) return false;
      if (filtroAno !== "todos" && doc.ano !== parseInt(filtroAno)) return false;
      if (filtroStatus !== "todos" && doc.status !== filtroStatus) return false;
      if (search) {
        const term = search.toLowerCase();
        const nomeMatch = doc.colaborador_nome.toLowerCase().includes(term);
        const tipoMatch = doc.tipo.toLowerCase().includes(term);
        const statusMatch = doc.status.toLowerCase().includes(term);
        if (!nomeMatch && !tipoMatch && !statusMatch) return false;
      }
      return true;
    });
  }, [documentos, filtroTipo, filtroUnidade, filtroColab, filtroMes, filtroAno, filtroStatus, search]);

  // Anos disponíveis
  const anos = useMemo(() => {
    const set = new Set<number>();
    documentos.forEach(d => { if (d.ano) set.add(d.ano); });
    return Array.from(set).sort((a, b) => b - a);
  }, [documentos]);

  const getTipoLabel = (tipo: string) => {
    const map: Record<string, string> = {
      contracheque: "Contracheque",
      adiantamento: "Adiantamento",
      ponto: "Folha de Ponto",
      atestado: "Atestado",
      disciplinar: "Registro Disciplinar",
    };
    return map[tipo] || tipo;
  };

  const getStatusBadge = (status: string, tipo: string) => {
    if (tipo === "atestado") {
      if (status === "aprovado") return <Badge className="bg-green-100 text-green-700 border-green-200">Aprovado</Badge>;
      if (status === "rejeitado") return <Badge className="bg-red-100 text-red-700 border-red-200">Rejeitado</Badge>;
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendente</Badge>;
    }
    if (tipo === "disciplinar") {
      const map: Record<string, string> = {
        advertencia: "Advertência",
        suspensao: "Suspensão",
        justa_causa: "Justa Causa",
        outro: "Outro",
      };
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{map[status] || status}</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 border-green-200">Disponível</Badge>;
  };

  // Ações
  const handleDownload = async (doc: DocumentoUnificado) => {
    if (!doc.storage_path) {
      toast.warning("Este documento não possui arquivo anexado.");
      return;
    }
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const handlePreview = async (doc: DocumentoUnificado) => {
    if (!doc.storage_path) {
      toast.warning("Este documento não possui arquivo para visualização.");
      return;
    }
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
  };

  const openEdit = (doc: DocumentoUnificado) => {
    setEditDoc(doc);
    setEditOpen(true);
    if (doc.tipo === "atestado") {
      setEditForm({
        status: doc.status,
        dias_afastamento: doc.dias_afastamento || "",
        observacao_admin: doc.observacao_admin || "",
        observacao: doc.observacao || "",
      });
    } else if (doc.tipo === "disciplinar") {
      setEditForm({
        tipo: doc.tipo_disciplinar || "outro",
        observacao: doc.observacao || "",
        dias_afastamento: doc.dias_afastamento || "",
      });
    } else {
      setEditForm({
        mes: doc.mes || "",
        ano: doc.ano || "",
      });
    }
  };

  const handleEditSave = async () => {
    if (!editDoc) return;
    setBusy(true);
    try {
      if (editDoc.tipo === "atestado") {
        const updates: any = {
          status: editForm.status,
          dias_afastamento: parseInt(editForm.dias_afastamento) || 0,
          observacao_admin: editForm.observacao_admin || null,
          observacao: editForm.observacao || null,
          updated_at: new Date().toISOString(),
        };
        if (editForm.status === "aprovado" || editForm.status === "rejeitado") {
          updates.respondido_em = new Date().toISOString();
          updates.respondido_por = user?.id;
        }
        const { error } = await supabase
          .from("atestados")
          .update(updates)
          .eq("id", editDoc.id);
        if (error) throw error;
      } else if (editDoc.tipo === "disciplinar") {
        const updates: any = {
          tipo: editForm.tipo,
          observacao: editForm.observacao || null,
          dias_afastamento: parseInt(editForm.dias_afastamento) || 0,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from("registros_disciplinares")
          .update(updates)
          .eq("id", editDoc.id);
        if (error) throw error;
      } else {
        // Documentos (contracheque, adiantamento, ponto)
        const { error } = await supabase
          .from("documentos")
          .update({
            mes: parseInt(editForm.mes),
            ano: parseInt(editForm.ano),
          })
          .eq("id", editDoc.id);
        if (error) throw error;
      }
      toast.success("Documento atualizado com sucesso!");
      setEditOpen(false);
      loadData();
    } catch (error) {
      console.error("Erro ao editar:", error);
      toast.error("Erro ao atualizar", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (doc: DocumentoUnificado) => {
    setDeleteDoc(doc);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteDoc) return;
    setBusy(true);
    try {
      // Remover arquivo do storage se existir
      if (deleteDoc.storage_path) {
        await supabase.storage.from("documentos").remove([deleteDoc.storage_path]);
      }

      let table: string;
      if (deleteDoc.tipo === "atestado") table = "atestados";
      else if (deleteDoc.tipo === "disciplinar") table = "registros_disciplinares";
      else table = "documentos";

      const { error } = await supabase.from(table).delete().eq("id", deleteDoc.id);
      if (error) throw error;

      toast.success("Documento excluído com sucesso!");
      setDeleteOpen(false);
      setDeleteDoc(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Histórico Completo de Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualize todos os documentos de todos os colaboradores em um único lugar.
        </p>
      </div>

      {/* Filtros */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Colaborador</Label>
              <Select value={filtroColab} onValueChange={setFiltroColab}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anos.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, tipo ou status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              setFiltroTipo("todos");
              setFiltroUnidade("todos");
              setFiltroColab("todos");
              setFiltroMes("todos");
              setFiltroAno("todos");
              setFiltroStatus("todos");
              setSearch("");
            }}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de documentos */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhum documento encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Colaborador</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Tipo</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Competência</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Unidade</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden xl:table-cell">Data</th>
                  <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtrados.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">{doc.colaborador_nome}</td>
                    <td className="p-4">
                      <Badge variant="outline">{getTipoLabel(doc.tipo)}</Badge>
                    </td>
                    <td className="p-4 hidden md:table-cell font-mono">
                      {doc.mes && doc.ano ? `${String(doc.mes).padStart(2, "0")}/${doc.ano}` : "—"}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">
                      {doc.unidade_nome || "—"}
                    </td>
                    <td className="p-4 text-center">
                      {getStatusBadge(doc.status, doc.tipo)}
                    </td>
                    <td className="p-4 hidden xl:table-cell text-xs text-muted-foreground">
                      {formatBR(new Date(doc.created_at))}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Visualizar"
                          onClick={() => handlePreview(doc)}
                          disabled={!doc.storage_path}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Baixar"
                          onClick={() => handleDownload(doc)}
                          disabled={!doc.storage_path}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Editar"
                          onClick={() => openEdit(doc)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Excluir"
                          onClick={() => confirmDelete(doc)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border text-xs text-muted-foreground text-right">
            {filtrados.length} documento(s) encontrado(s)
          </div>
        </div>
      )}

      {/* Dialog de pré-visualização */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
            <DialogDescription>
              {selectedDoc
                ? `${getTipoLabel(selectedDoc.tipo)} - ${selectedDoc.colaborador_nome}`
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
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button
              onClick={() => {
                if (selectedDoc) handleDownload(selectedDoc);
              }}
              disabled={!selectedDoc?.storage_path}
            >
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar {editDoc ? getTipoLabel(editDoc.tipo) : "Documento"}
            </DialogTitle>
            <DialogDescription>
              {editDoc?.colaborador_nome} - {editDoc?.mes && editDoc?.ano ? `${String(editDoc.mes).padStart(2, "0")}/${editDoc.ano}` : ""}
            </DialogDescription>
          </DialogHeader>
          {editDoc && (
            <div className="space-y-4 py-4">
              {editDoc.tipo === "atestado" ? (
                <>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="aprovado">Aprovado</SelectItem>
                        <SelectItem value="rejeitado">Rejeitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dias de Afastamento</Label>
                    <Input
                      type="number"
                      value={editForm.dias_afastamento}
                      onChange={(e) => setEditForm({ ...editForm, dias_afastamento: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observação do Admin</Label>
                    <Textarea
                      value={editForm.observacao_admin || ""}
                      onChange={(e) => setEditForm({ ...editForm, observacao_admin: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observação</Label>
                    <Textarea
                      value={editForm.observacao || ""}
                      onChange={(e) => setEditForm({ ...editForm, observacao: e.target.value })}
                      rows={2}
                    />
                  </div>
                </>
              ) : editDoc.tipo === "disciplinar" ? (
                <>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={editForm.tipo}
                      onValueChange={(v) => setEditForm({ ...editForm, tipo: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="advertencia">Advertência</SelectItem>
                        <SelectItem value="suspensao">Suspensão</SelectItem>
                        <SelectItem value="justa_causa">Justa Causa</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dias de Afastamento</Label>
                    <Input
                      type="number"
                      value={editForm.dias_afastamento}
                      onChange={(e) => setEditForm({ ...editForm, dias_afastamento: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observação</Label>
                    <Textarea
                      value={editForm.observacao || ""}
                      onChange={(e) => setEditForm({ ...editForm, observacao: e.target.value })}
                      rows={2}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Mês</Label>
                    <Select
                      value={String(editForm.mes)}
                      onValueChange={(v) => setEditForm({ ...editForm, mes: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                      <SelectContent>
                        {MESES.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ano</Label>
                    <Input
                      type="number"
                      value={editForm.ano}
                      onChange={(e) => setEditForm({ ...editForm, ano: e.target.value })}
                      placeholder="2026"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de exclusão */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento?
              <br /><br />
              <strong>Colaborador:</strong> {deleteDoc?.colaborador_nome}
              <br />
              <strong>Tipo:</strong> {deleteDoc ? getTipoLabel(deleteDoc.tipo) : ""}
              <br />
              {deleteDoc?.mes && deleteDoc?.ano && (
                <>
                  <strong>Competência:</strong> {String(deleteDoc.mes).padStart(2, "0")}/{deleteDoc.ano}
                  <br />
                </>
              )}
              <br />
              Esta ação <strong>não pode ser desfeita</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {busy ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}