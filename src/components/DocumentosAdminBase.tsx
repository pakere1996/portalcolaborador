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
  data: string; // nome genérico, será mapeado para o campo real
  observacao: string | null;
  storage_path: string;
  storage_type: string;
  created_at: string;
  updated_at: string;
  // Campos específicos
  dias_afastamento?: number | null;
  status?: string | null;
  observacao_admin?: string | null;
  respondido_em?: string | null;
  tipo?: string | null;
  [key: string]: any; // para acessar campos dinâmicos
}

interface DocumentosAdminBaseProps {
  tipo: "atestados" | "registros_disciplinares";
  titulo: string;
  icone: React.ReactNode;
  descricao: string;
  importTitle: string;
  campoData: string; // nome da coluna de data (ex: "data_atestado", "data")
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
      // Usa campoData para ordenação
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

      // Mapeia para garantir que o campo "data" seja preenchido
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

  // Filtrar colaboradores
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

  // Restante do JSX (tabela) – precisa usar d.data para exibir a data.
  // O restante é igual ao que já temos, apenas na célula de data use `d.data`.
  
  // [Código do JSX omitido por brevidade, mas mantenha a tabela e filtros]
}