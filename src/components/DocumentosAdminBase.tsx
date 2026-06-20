import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, History, Download, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { formatBR } from "@/lib/folga-rules";
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
import { Textarea } from "@/components/ui/textarea";

interface Profile {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

interface DocumentoAdmin {
  id: string;
  colaborador_id: string;
  unidade_id: string;
  data: string; // campo unificado
  observacao: string | null;
  storage_path: string;
  storage_type: string;
  created_at: string;
  updated_at: string;
  // Atestados
  dias_afastamento?: number | null;
  status?: string | null;
  observacao_admin?: string | null;
  respondido_em?: string | null;
  // Disciplinares
  tipo?: string | null;
  [key: string]: any;
}

interface DocumentosAdminBaseProps {
  tipo: "atestados" | "registros_disciplinares";
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  importTitle: string;
  campoData: string; // ex: "data_atestado" ou "data"
  gerarStoragePath: (colaboradorId: string, data: string, id: string, file: File) => Promise<{ path: string; kind: "pdf" | "image" }>;
  formatarStatus?: (status: string) => string;
  statusClass?: (status: string) => string;
  camposExtras?: (form: any, setForm: any, busy: boolean) => React.ReactNode;
  colunasExtras?: (doc: DocumentoAdmin) => React.ReactNode;
  editCamposExtras?: (editForm: any, setEditForm: any) => React.ReactNode;
  validarForm?: (form: any) => string | null;
  beforeInsert?: (form: any, path: string, kind: string) => Promise<any> | any;
}

export function DocumentosAdminBase({
  tipo,
  titulo,
  icone,
  descricao,
  importTitle,
  campoData,
  gerarStoragePath,
  formatarStatus,
  statusClass,
  camposExtras,
  colunasExtras,
  editCamposExtras,
  validarForm,
  beforeInsert,
}: DocumentosAdminBaseProps) {
  const [aba, setAba] = useState<"importar" | "historico">("importar");
  const [documentos, setDocumentos] = useState<DocumentoAdmin[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filtroUnidade, setFiltroUnidade] = useState("todos");
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroExtra, setFiltroExtra] = useState("todos");

  // Formulário
  const [form, setForm] = useState({
    colaborador_id: "",
    unidade_id: "",
    data_documento: "",
    observacao: "",
    arquivo: null as File | null,
    dias_afastamento: "",
    tipo: "",
  });
  const [uploading, setUploading] = useState(false);

  // Edição
  const [editando, setEditando] = useState<DocumentoAdmin | null>(null);
  const [editForm, setEditForm] = useState({
    data_documento: "",
    observacao: "",
    dias_afastamento: "",
    tipo: "",
    status: "",
    observacao_admin: "",
  });
  const [editBusy, setEditBusy] = useState(false);

  // Exclusão
  const [excluirDialogOpen, setExcluirDialogOpen] = useState(false);
  const [documentoParaExcluir, setDocumentoParaExcluir] = useState<DocumentoAdmin | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const table = tipo === "atestados" ? "atestados" : "registros_disciplinares";
      const { data: docs, error: docsError } = await supabase
        .from(table)
        .select("*")
        .order(campoData, { ascending: false });
      if (docsError) throw docsError;

      const { data: profs, error: profsError } = await supabase
        .from("profiles")
        .select("id, nome, unidade_id")
        .eq("ativo", true)
        .order("nome");
      if (profsError) throw profsError;

      const { data: units, error: unitsError } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (unitsError) throw unitsError;

      // Mapeia para unificar o campo data
      const docsMapeados = (docs ?? []).map((doc: any) => ({
        ...doc,
        data: doc[campoData] || doc.data || doc.data_documento || "",
      }));

      setDocumentos(docsMapeados);
      setProfiles(profs ?? []);
      setUnidades(units ?? []);
    } catch (error) {
      console.error("Erro ao carregar:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [tipo, campoData]);

  useEffect(() => {
    load();
  }, [load]);

  const filtrados = useMemo(() => {
    return documentos.filter((d) => {
      if (filtroUnidade !== "todos" && d.unidade_id !== filtroUnidade) return false;
      if (filtroColab !== "todos" && d.colaborador_id !== filtroColab) return false;
      const dataDoc = d.data;
      if (filtroDataInicio && dataDoc < filtroDataInicio) return false;
      if (filtroDataFim && dataDoc > filtroDataFim) return false;
      if (filtroExtra !== "todos") {
        if (tipo === "atestados" && d.status !== filtroExtra) return false;
        if (tipo === "registros_disciplinares" && d.tipo !== filtroExtra) return false;
      }
      return true;
    });
  }, [documentos, filtroUnidade, filtroColab, filtroDataInicio, filtroDataFim, filtroExtra, tipo]);

  const handleUpload = async () => {
    if (!form.unidade_id || !form.colaborador_id || !form.data_documento || !form.arquivo) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (validarForm) {
      const erro = validarForm(form);
      if (erro) { toast.error(erro); return; }
    }

    setUploading(true);
    try {
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const { path, kind } = await gerarStoragePath(form.colaborador_id, form.data_documento, id, form.arquivo);

      const { error: uploadError } = await supabase.storage
        .from("documentos_admin")
        .upload(path, form.arquivo);
      if (uploadError) throw uploadError;

      const dados = beforeInsert
        ? await beforeInsert(form, path, kind)
        : {
            colaborador_id: form.colaborador_id,
            unidade_id: form.unidade_id,
            [campoData]: form.data_documento,
            observacao: form.observacao || null,
            storage_path: path,
            storage_type: kind,
            criado_por: (await supabase.auth.getUser()).data.user?.id,
          };

      const table = tipo === "atestados" ? "atestados" : "registros_disciplinares";
      const { error: insertError } = await supabase.from(table).insert(dados);
      if (insertError) throw insertError;

      toast.success("Documento importado com sucesso!");
      setForm({
        colaborador_id: "",
        unidade_id: "",
        data_documento: "",
        observacao: "",
        arquivo: null,
        dias_afastamento: "",
        tipo: "",
      });
      load();
    } catch (error) {
      console.error("Erro ao importar:", error);
      toast.error("Erro ao importar", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = useCallback(async (doc: DocumentoAdmin) => {
    const { data } = await supabase.storage
      .from("documentos_admin")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link de download");
  }, []);

  const handleEditSave = async () => {
    if (!editando) return;
    setEditBusy(true);
    try {
      const table = tipo === "atestados" ? "atestados" : "registros_disciplinares";
      const updates: any = {
        updated_at: new Date().toISOString(),
        observacao: editForm.observacao || null,
        [campoData]: editForm.data_documento,
      };

      if (tipo === "atestados") {
        updates.dias_afastamento = parseInt(editForm.dias_afastamento) || 0;
        updates.status = editForm.status || "pendente";
        updates.observacao_admin = editForm.observacao_admin || null;
        if (editForm.status === "aprovado" || editForm.status === "rejeitado") {
          updates.respondido_em = new Date().toISOString();
          updates.respondido_por = (await supabase.auth.getUser()).data.user?.id;
        }
      } else {
        updates.tipo = editForm.tipo || "outro";
      }

      const { error } = await supabase.from(table).update(updates).eq("id", editando.id);
      if (error) throw error;

      toast.success("Documento atualizado!");
      setEditando(null);
      load();
    } catch (error) {
      console.error("Erro ao editar:", error);
      toast.error("Erro ao editar", { description: (error as Error).message });
    } finally {
      setEditBusy(false);
    }
  };

  const handleExcluir = useCallback((doc: DocumentoAdmin) => {
    setDocumentoParaExcluir(doc);
    setExcluirDialogOpen(true);
  }, []);

  const confirmarExclusao = useCallback(async () => {
    if (!documentoParaExcluir) return;
    setExcluindo(true);
    try {
      const table = tipo === "atestados" ? "atestados" : "registros_disciplinares";
      await supabase.storage.from("documentos_admin").remove([documentoParaExcluir.storage_path]);
      const { error } = await supabase.from(table).delete().eq("id", documentoParaExcluir.id);
      if (error) throw error;
      toast.success("Documento excluído!");
      setExcluirDialogOpen(false);
      setDocumentoParaExcluir(null);
      load();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir", { description: (error as Error).message });
    } finally {
      setExcluindo(false);
    }
  }, [documentoParaExcluir, load, tipo]);

  const colaboradoresFiltrados = profiles.filter(
    (p) => !form.unidade_id || p.unidade_id === form.unidade_id
  );

  const filtroExtraOptions = useMemo(() => {
    if (tipo === "atestados") {
      return [
        { value: "todos", label: "Todos" },
        { value: "pendente", label: "Pendente" },
        { value: "aprovado", label: "Aprovado" },
        { value: "rejeitado", label: "Rejeitado" },
      ];
    } else {
      return [
        { value: "todos", label: "Todos" },
        { value: "advertencia", label: "Advertência" },
        { value: "suspensao", label: "Suspensão" },
        { value: "justa_causa", label: "Justa Causa" },
        { value: "outro", label: "Outro" },
      ];
    }
  }, [tipo]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Unidade *</Label>
                <Select
                  value={form.unidade_id}
                  onValueChange={(value) => setForm({ ...form, unidade_id: value, colaborador_id: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Colaborador *</Label>
                <Select
                  value={form.colaborador_id}
                  onValueChange={(value) => setForm({ ...form, colaborador_id: value })}
                  disabled={!form.unidade_id}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
                  <SelectContent>
                    {colaboradoresFiltrados.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                    {colaboradoresFiltrados.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                        Nenhum colaborador nesta unidade
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data do Documento *</Label>
                <Input
                  type="date"
                  value={form.data_documento}
                  onChange={(e) => setForm({ ...form, data_documento: e.target.value })}
                />
              </div>

              {camposExtras && camposExtras(form, setForm, uploading)}

              <div className="space-y-2">
                <Label>Arquivo (PDF ou Imagem) *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setForm({ ...form, arquivo: file });
                    }}
                  />
                  {form.arquivo && (
                    <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, arquivo: null })}>
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
                {form.arquivo && (
                  <p className="text-xs text-muted-foreground">
                    {form.arquivo.name} ({(form.arquivo.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  rows={3}
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                  placeholder="Observações adicionais (opcional)"
                />
              </div>

              <Button onClick={handleUpload} disabled={uploading} className="w-full">
                {uploading ? <><Loader2 className="size-4 mr-2 animate-spin" /> Importando...</> : <><Upload className="size-4 mr-2" /> Importar</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {aba === "historico" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Unidade</Label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Colaborador</Label>
              <Select value={filtroColab} onValueChange={setFiltroColab}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Data Início</Label>
              <Input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Data Fim</Label>
              <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-bold">
                {tipo === "atestados" ? "Status" : "Tipo"}
              </Label>
              <Select value={filtroExtra} onValueChange={setFiltroExtra}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {filtroExtraOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Unidade</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden md:table-cell">Data</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden lg:table-cell">Observações</th>
                    <th className="text-center p-4 font-bold uppercase text-[10px] text-muted-foreground">
                      {tipo === "atestados" ? "Status" : "Tipo"}
                    </th>
                    {colunasExtras && <th className="text-center p-4 font-bold uppercase text-[10px] text-muted-foreground">Detalhes</th>}
                    <th className="text-center p-4 font-bold uppercase text-[10px] text-muted-foreground">Arquivo</th>
                    <th className="text-right p-4 font-bold uppercase text-[10px] text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((doc) => {
                    const profile = profiles.find((p) => p.id === doc.colaborador_id);
                    const unidade = unidades.find((u) => u.id === doc.unidade_id);
                    const isEditing = editando?.id === doc.id;
                    const dataDoc = doc.data;

                    let dataRetorno = "";
                    if (tipo === "atestados" && doc.dias_afastamento) {
                      const dt = new Date(dataDoc + "T00:00:00");
                      dt.setDate(dt.getDate() + (doc.dias_afastamento || 0));
                      dataRetorno = formatBR(dt);
                    }

                    return (
                      <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-medium">{profile?.nome ?? "—"}</td>
                        <td className="p-4 text-muted-foreground">{unidade?.nome ?? "—"}</td>
                        <td className="p-4 hidden md:table-cell">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editForm.data_documento}
                              onChange={(e) => setEditForm({ ...editForm, data_documento: e.target.value })}
                              className="w-auto"
                            />
                          ) : (
                            <>
                              {formatBR(new Date(dataDoc + "T00:00:00"))}
                              {tipo === "atestados" && doc.dias_afastamento && (
                                <div className="text-xs text-muted-foreground">
                                  Retorno: {dataRetorno}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          {isEditing ? (
                            <Input
                              value={editForm.observacao}
                              onChange={(e) => setEditForm({ ...editForm, observacao: e.target.value })}
                              className="w-auto"
                              placeholder="Observações"
                            />
                          ) : (
                            <span className="text-xs truncate max-w-[150px] block">
                              {doc.observacao || "—"}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {isEditing ? (
                            <div className="space-y-1">
                              {tipo === "atestados" ? (
                                <select
                                  className="w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                                  value={editForm.status || "pendente"}
                                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                >
                                  <option value="pendente">Pendente</option>
                                  <option value="aprovado">Aprovado</option>
                                  <option value="rejeitado">Rejeitado</option>
                                </select>
                              ) : (
                                <select
                                  className="w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
                                  value={editForm.tipo || "outro"}
                                  onChange={(e) => setEditForm({ ...editForm, tipo: e.target.value })}
                                >
                                  <option value="advertencia">Advertência</option>
                                  <option value="suspensao">Suspensão</option>
                                  <option value="justa_causa">Justa Causa</option>
                                  <option value="outro">Outro</option>
                                </select>
                              )}
                              {editCamposExtras && editCamposExtras(editForm, setEditForm)}
                            </div>
                          ) : (
                            <>
                              {tipo === "atestados" ? (
                                <Badge className={
                                  doc.status === "aprovado" ? "bg-green-100 text-green-700 border-green-200" :
                                  doc.status === "rejeitado" ? "bg-red-100 text-red-700 border-red-200" :
                                  "bg-yellow-100 text-yellow-700 border-yellow-200"
                                }>
                                  {formatarStatus ? formatarStatus(doc.status || "pendente") : doc.status || "pendente"}
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                  {doc.tipo || "outro"}
                                </Badge>
                              )}
                            </>
                          )}
                        </td>
                        {colunasExtras && (
                          <td className="p-4 text-center">
                            {isEditing ? (
                              editCamposExtras ? editCamposExtras(editForm, setEditForm) : null
                            ) : (
                              colunasExtras(doc)
                            )}
                          </td>
                        )}
                        <td className="p-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600"
                            onClick={() => handleDownload(doc)}
                          >
                            <FileText className="size-4 mr-1" /> {doc.storage_type === "pdf" ? "PDF" : "Imagem"}
                          </Button>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            {isEditing ? (
                              <>
                                <Button variant="default" size="sm" onClick={handleEditSave} disabled={editBusy}>
                                  {editBusy ? <Loader2 className="size-4 animate-spin" /> : "Salvar"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  title="Editar"
                                  onClick={() => {
                                    setEditando(doc);
                                    if (tipo === "atestados") {
                                      setEditForm({
                                        data_documento: doc.data,
                                        observacao: doc.observacao || "",
                                        dias_afastamento: String(doc.dias_afastamento || ""),
                                        tipo: "",
                                        status: doc.status || "pendente",
                                        observacao_admin: doc.observacao_admin || "",
                                      });
                                    } else {
                                      setEditForm({
                                        data_documento: doc.data,
                                        observacao: doc.observacao || "",
                                        dias_afastamento: "",
                                        tipo: doc.tipo || "outro",
                                        status: "",
                                        observacao_admin: "",
                                      });
                                    }
                                  }}
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
                              </>
                            )}
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

      <AlertDialog open={excluirDialogOpen} onOpenChange={setExcluirDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este documento?
              <br /><br />
              <strong>Colaborador:</strong> {profiles.find(p => p.id === documentoParaExcluir?.colaborador_id)?.nome ?? "—"}
              <br />
              <strong>Data:</strong> {documentoParaExcluir ? formatBR(new Date(documentoParaExcluir.data + "T00:00:00")) : ""}
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