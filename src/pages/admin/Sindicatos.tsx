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
  Upload,
  Check,
} from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { cn } from "@/lib/utils";

// --- Formatação ---
const onlyNumbers = (value: string) => value.replace(/\D/g, "");
const formatCNPJ = (value: string) => {
  const clean = onlyNumbers(value);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return clean.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
  if (clean.length <= 8) return clean.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (clean.length <= 12) return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
};
const formatWhatsApp = (value: string) => {
  const clean = onlyNumbers(value);
  if (clean.length <= 2) return clean;
  if (clean.length <= 6) return clean.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  if (clean.length <= 10) return clean.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return clean.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

// --- Interfaces ---
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

interface Unidade {
  id: string;
  nome: string;
}

interface Cargo {
  id: string;
  nome: string;
}

// Tipo para agrupar patronal + laboral na listagem
interface GrupoSindicato {
  patronal: Sindicato | null;
  laboral: Sindicato | null;
  documentosPatronal: DocumentoSindicato[];
  documentossLaboral: DocumentoSindicato[];
}

const TIPOS_DOCUMENTO = [
  { value: "act", label: "ACT (Acordo Coletivo de Trabalho)" },
  { value: "cct", label: "CCT (Convenção Coletiva de Trabalho)" },
];

export default function Sindicatos() {
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // --- Estado da ficha unificada ---
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<{ patronal: Sindicato | null; laboral: Sindicato | null }>({
    patronal: null,
    laboral: null,
  });

  // Dados do patronal (inclui arquivo)
  const [patronalForm, setPatronalForm] = useState({
    nome: "",
    cnpj: "",
    contato_whatsapp: "",
    arquivo: null as File | null,
    tipo_documento: "act" as "act" | "cct",
    ano: new Date().getFullYear(),
  });
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<string[]>([]);

  // Dados do laboral (inclui arquivo)
  const [laboralForm, setLaboralForm] = useState({
    nome: "",
    cnpj: "",
    contato_whatsapp: "",
    arquivo: null as File | null,
    tipo_documento: "act" as "act" | "cct",
    ano: new Date().getFullYear(),
  });
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);

  // --- Documentos (diálogo separado – para visualização e gerenciamento) ---
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

  // --- Exclusão e preview ---
  const [confirmDelete, setConfirmDelete] = useState<{ patronal: Sindicato | null; laboral: Sindicato | null }>({
    patronal: null,
    laboral: null,
  });
  const [deletingDoc, setDeletingDoc] = useState<DocumentoSindicato | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Filtros
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  // --- Loaders ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sindRes, unidRes, cargoRes] = await Promise.all([
        supabase.from("sindicatos").select("*").order("nome", { ascending: true }),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (sindRes.error) throw sindRes.error;
      if (unidRes.error) throw unidRes.error;
      if (cargoRes.error) throw cargoRes.error;

      setSindicatos(sindRes.data ?? []);
      setUnidades(unidRes.data ?? []);
      setCargos(cargoRes.data ?? []);
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

  // --- Handlers de formatação ---
  const handleCNPJChange = (setter: any, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter((prev: any) => ({ ...prev, [field]: formatCNPJ(e.target.value) }));
  };
  const handleWhatsAppChange = (setter: any, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter((prev: any) => ({ ...prev, [field]: formatWhatsApp(e.target.value) }));
  };

  // --- Abrir diálogo de documentos (para gerenciamento) ---
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

  // --- Abrir ficha unificada para edição (recebe um sindicato, busca o par) ---
  const abrirEdicao = async (sindicato: Sindicato) => {
    // Buscar o outro sindicato do mesmo "grupo" (mesmo nome ou CNPJ)
    const { data: outros } = await supabase
      .from("sindicatos")
      .select("*")
      .or(`nome.eq.${sindicato.nome},cnpj.eq.${sindicato.cnpj}`)
      .neq("id", sindicato.id);

    const outro = outros?.find((s: any) => s.tipo !== sindicato.tipo) || null;

    const isPatronal = sindicato.tipo === "patronal";
    const patronal = isPatronal ? sindicato : outro;
    const laboral = isPatronal ? outro : sindicato;

    setEditando({ patronal, laboral });

    // Carregar dados do patronal
    if (patronal) {
      setPatronalForm({
        nome: patronal.nome,
        cnpj: patronal.cnpj ? formatCNPJ(patronal.cnpj) : "",
        contato_whatsapp: patronal.contato_whatsapp ? formatWhatsApp(patronal.contato_whatsapp) : "",
        arquivo: null,
        tipo_documento: "act",
        ano: new Date().getFullYear(),
      });
      const { data: vinculos } = await supabase
        .from("sindicato_unidades")
        .select("unidade_id")
        .eq("sindicato_id", patronal.id);
      setUnidadesSelecionadas(vinculos?.map(v => v.unidade_id) ?? []);
    } else {
      setPatronalForm({
        nome: "",
        cnpj: "",
        contato_whatsapp: "",
        arquivo: null,
        tipo_documento: "act",
        ano: new Date().getFullYear(),
      });
      setUnidadesSelecionadas([]);
    }

    // Carregar dados do laboral
    if (laboral) {
      setLaboralForm({
        nome: laboral.nome,
        cnpj: laboral.cnpj ? formatCNPJ(laboral.cnpj) : "",
        contato_whatsapp: laboral.contato_whatsapp ? formatWhatsApp(laboral.contato_whatsapp) : "",
        arquivo: null,
        tipo_documento: "act",
        ano: new Date().getFullYear(),
      });
      const { data: vinculos } = await supabase
        .from("sindicato_cargos")
        .select("cargo_id")
        .eq("sindicato_id", laboral.id);
      setCargosSelecionados(vinculos?.map(v => v.cargo_id) ?? []);
    } else {
      setLaboralForm({
        nome: "",
        cnpj: "",
        contato_whatsapp: "",
        arquivo: null,
        tipo_documento: "act",
        ano: new Date().getFullYear(),
      });
      setCargosSelecionados([]);
    }

    setDialogOpen(true);
  };

  // --- Salvar ficha unificada com upload de documentos integrado ---
  const salvarFichaUnificada = async () => {
    if (!patronalForm.nome.trim()) {
      toast.error("Nome do sindicato patronal é obrigatório");
      return;
    }
    if (unidadesSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma unidade para o sindicato patronal");
      return;
    }
    if (!laboralForm.nome.trim()) {
      toast.error("Nome do sindicato laboral é obrigatório");
      return;
    }
    if (cargosSelecionados.length === 0) {
      toast.error("Selecione pelo menos um cargo para o sindicato laboral");
      return;
    }

    setBusy(true);
    try {
      // 1. Salvar/atualizar patronal
      const patronalDados = {
        nome: patronalForm.nome.trim(),
        cnpj: patronalForm.cnpj ? onlyNumbers(patronalForm.cnpj) : null,
        tipo: "patronal" as const,
        contato_whatsapp: patronalForm.contato_whatsapp ? onlyNumbers(patronalForm.contato_whatsapp) : null,
        updated_at: new Date().toISOString(),
      };

      let patronalId: string;
      if (editando.patronal) {
        const { error } = await supabase
          .from("sindicatos")
          .update(patronalDados)
          .eq("id", editando.patronal.id);
        if (error) throw error;
        patronalId = editando.patronal.id;
      } else {
        const { data, error } = await supabase
          .from("sindicatos")
          .insert(patronalDados)
          .select("id")
          .single();
        if (error) throw error;
        patronalId = data.id;
      }

      // 2. Vínculos patronal
      await supabase.from("sindicato_unidades").delete().eq("sindicato_id", patronalId);
      if (unidadesSelecionadas.length > 0) {
        const inserts = unidadesSelecionadas.map(unidade_id => ({
          sindicato_id: patronalId,
          unidade_id,
        }));
        await supabase.from("sindicato_unidades").insert(inserts);
      }

      // 3. Upload do documento patronal (se houver)
      if (patronalForm.arquivo) {
        const path = `sindicato_${patronalId}/${patronalForm.tipo_documento}_${patronalForm.ano}.pdf`;
        await supabase.storage.from("sindicatos").upload(path, patronalForm.arquivo, { upsert: true });
        await supabase.from("documentos_sindicato").insert({
          sindicato_id: patronalId,
          ano: patronalForm.ano,
          tipo_documento: patronalForm.tipo_documento,
          storage_path: path,
          nome_pdf: patronalForm.arquivo.name,
        });
      }

      // 4. Salvar/atualizar laboral
      const laboralDados = {
        nome: laboralForm.nome.trim(),
        cnpj: laboralForm.cnpj ? onlyNumbers(laboralForm.cnpj) : null,
        tipo: "laboral" as const,
        contato_whatsapp: laboralForm.contato_whatsapp ? onlyNumbers(laboralForm.contato_whatsapp) : null,
        updated_at: new Date().toISOString(),
      };

      let laboralId: string;
      if (editando.laboral) {
        const { error } = await supabase
          .from("sindicatos")
          .update(laboralDados)
          .eq("id", editando.laboral.id);
        if (error) throw error;
        laboralId = editando.laboral.id;
      } else {
        const { data, error } = await supabase
          .from("sindicatos")
          .insert(laboralDados)
          .select("id")
          .single();
        if (error) throw error;
        laboralId = data.id;
      }

      // 5. Vínculos laboral
      await supabase.from("sindicato_cargos").delete().eq("sindicato_id", laboralId);
      if (cargosSelecionados.length > 0) {
        const inserts = cargosSelecionados.map(cargo_id => ({
          sindicato_id: laboralId,
          cargo_id,
        }));
        await supabase.from("sindicato_cargos").insert(inserts);
      }

      // 6. Upload do documento laboral (se houver)
      if (laboralForm.arquivo) {
        const path = `sindicato_${laboralId}/${laboralForm.tipo_documento}_${laboralForm.ano}.pdf`;
        await supabase.storage.from("sindicatos").upload(path, laboralForm.arquivo, { upsert: true });
        await supabase.from("documentos_sindicato").insert({
          sindicato_id: laboralId,
          ano: laboralForm.ano,
          tipo_documento: laboralForm.tipo_documento,
          storage_path: path,
          nome_pdf: laboralForm.arquivo.name,
        });
      }

      toast.success("Ficha salva com sucesso!");
      setDialogOpen(false);
      setEditando({ patronal: null, laboral: null });
      // Reset forms
      setPatronalForm({ nome: "", cnpj: "", contato_whatsapp: "", arquivo: null, tipo_documento: "act", ano: new Date().getFullYear() });
      setLaboralForm({ nome: "", cnpj: "", contato_whatsapp: "", arquivo: null, tipo_documento: "act", ano: new Date().getFullYear() });
      setUnidadesSelecionadas([]);
      setCargosSelecionados([]);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar ficha:", error);
      toast.error("Erro ao salvar ficha", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // --- Excluir par de sindicatos (patronal + laboral juntos) ---
  const excluirPar = async () => {
    const ids = [];
    if (confirmDelete.patronal) ids.push(confirmDelete.patronal.id);
    if (confirmDelete.laboral) ids.push(confirmDelete.laboral.id);
    if (ids.length === 0) return;

    setBusy(true);
    try {
      // Remover documentos do storage para ambos
      for (const id of ids) {
        const { data: docs } = await supabase
          .from("documentos_sindicato")
          .select("storage_path")
          .eq("sindicato_id", id);
        if (docs && docs.length > 0) {
          const paths = docs.map(d => d.storage_path);
          await supabase.storage.from("sindicatos").remove(paths);
        }
      }
      const { error } = await supabase.from("sindicatos").delete().in("id", ids);
      if (error) throw error;
      toast.success("Sindicatos excluídos!");
      setConfirmDelete({ patronal: null, laboral: null });
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir sindicatos", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // --- Documentos (upload, delete, preview, download) ---
  const uploadDocumento = async () => {
    if (!sindicatoSelecionado) return;
    if (!docForm.arquivo) {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    setUploadingDoc(true);
    try {
      const path = `sindicato_${sindicatoSelecionado.id}/${docForm.tipo_documento}_${docForm.ano}.pdf`;
      await supabase.storage.from("sindicatos").upload(path, docForm.arquivo, { upsert: true });
      await supabase.from("documentos_sindicato").insert({
        sindicato_id: sindicatoSelecionado.id,
        ano: docForm.ano,
        tipo_documento: docForm.tipo_documento,
        storage_path: path,
        nome_pdf: docForm.arquivo.name,
      });
      toast.success("Documento anexado!");
      setDocForm({ ...docForm, arquivo: null });
      loadDocumentos(sindicatoSelecionado.id);
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao anexar documento");
    } finally {
      setUploadingDoc(false);
    }
  };

  const excluirDocumento = async () => {
    if (!deletingDoc) return;
    try {
      await supabase.storage.from("sindicatos").remove([deletingDoc.storage_path]);
      await supabase.from("documentos_sindicato").delete().eq("id", deletingDoc.id);
      toast.success("Documento removido!");
      setDeletingDoc(null);
      if (sindicatoSelecionado) loadDocumentos(sindicatoSelecionado.id);
    } catch (error) {
      console.error("Erro ao excluir documento:", error);
      toast.error("Erro ao excluir documento");
    }
  };

  const handleDownload = async (doc: DocumentoSindicato) => {
    const { data } = await supabase.storage.from("sindicatos").createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };
  const handlePreview = async (doc: DocumentoSindicato) => {
    const { data } = await supabase.storage.from("sindicatos").createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else toast.error("Erro ao gerar visualização");
  };

  // --- Helpers ---
  const getTipoLabel = (tipo: string | null) => (tipo === "patronal" ? "Patronal" : tipo === "laboral" ? "Laboral" : "—");
  const getDocTipoLabel = (tipo: string) => TIPOS_DOCUMENTO.find(t => t.value === tipo)?.label || tipo;

  const toggleUnidade = (id: string) =>
    setUnidadesSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleCargo = (id: string) =>
    setCargosSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // --- Agrupamento para listagem ---
  const grupos = useMemo(() => {
    const gruposMap = new Map<string, { patronal: Sindicato | null; laboral: Sindicato | null }>();
    const patronais = sindicatos.filter(s => s.tipo === "patronal");
    const laborais = sindicatos.filter(s => s.tipo === "laboral");

    // Tenta agrupar por nome ou CNPJ
    const used = new Set<string>();
    for (const p of patronais) {
      const chave = p.nome || p.cnpj || p.id;
      if (used.has(chave)) continue;
      const laboral = laborais.find(l => l.nome === p.nome || l.cnpj === p.cnpj);
      gruposMap.set(chave, { patronal: p, laboral: laboral || null });
      used.add(chave);
      if (laboral) used.add(laboral.nome || laboral.cnpj || laboral.id);
    }
    // Adiciona laborais órfãos
    for (const l of laborais) {
      const chave = l.nome || l.cnpj || l.id;
      if (!gruposMap.has(chave) && !used.has(chave)) {
        gruposMap.set(chave, { patronal: null, laboral: l });
        used.add(chave);
      }
    }
    return Array.from(gruposMap.values());
  }, [sindicatos]);

  // Filtro por nome ou tipo
  const gruposFiltrados = useMemo(() => {
    return grupos.filter(g => {
      const p = g.patronal;
      const l = g.laboral;
      const nomeMatch = (p?.nome || "").toLowerCase().includes(filtroNome.toLowerCase()) ||
                        (l?.nome || "").toLowerCase().includes(filtroNome.toLowerCase());
      const tipoMatch = filtroTipo === "todos" ||
                        (filtroTipo === "patronal" && p) ||
                        (filtroTipo === "laboral" && l);
      return nomeMatch && tipoMatch;
    });
  }, [grupos, filtroNome, filtroTipo]);

  // --- Renderização ---
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Sindicatos
          </h1>
          <p className="text-muted-foreground mt-1">Cadastro unificado de sindicatos patronal e laboral.</p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/sindicatos" label="Sindicatos" icone="Building2" />
          <Button onClick={() => {
            setEditando({ patronal: null, laboral: null });
            setPatronalForm({ nome: "", cnpj: "", contato_whatsapp: "", arquivo: null, tipo_documento: "act", ano: new Date().getFullYear() });
            setLaboralForm({ nome: "", cnpj: "", contato_whatsapp: "", arquivo: null, tipo_documento: "act", ano: new Date().getFullYear() });
            setUnidadesSelecionadas([]);
            setCargosSelecionados([]);
            setDialogOpen(true);
          }}>
            <Plus className="size-4 mr-2" /> Nova Ficha
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar</Label>
          <Input placeholder="Nome..." value={filtroNome} onChange={e => setFiltroNome(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="patronal">Patronal</SelectItem>
              <SelectItem value="laboral">Laboral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setFiltroNome(""); setFiltroTipo("todos"); }}>Limpar</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
      ) : gruposFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">Nenhum grupo de sindicatos cadastrado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {gruposFiltrados.map((g, idx) => {
            const p = g.patronal;
            const l = g.laboral;
            return (
              <Card key={idx} className="border-border shadow-sm hover:shadow-md transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg truncate">
                      {(p?.nome || l?.nome) || "Sem nome"}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Badge variant={p ? "secondary" : "outline"}>{p ? "Patronal" : "—"}</Badge>
                      <Badge variant={l ? "default" : "outline"}>{l ? "Laboral" : "—"}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {p && (
                    <div className="text-sm">
                      <span className="font-medium">Patronal:</span> {p.nome}
                      {p.cnpj && <span className="text-muted-foreground ml-2">CNPJ: {formatCNPJ(p.cnpj)}</span>}
                      {p.contato_whatsapp && <span className="text-muted-foreground ml-2">WhatsApp: {formatWhatsApp(p.contato_whatsapp)}</span>}
                    </div>
                  )}
                  {l && (
                    <div className="text-sm">
                      <span className="font-medium">Laboral:</span> {l.nome}
                      {l.cnpj && <span className="text-muted-foreground ml-2">CNPJ: {formatCNPJ(l.cnpj)}</span>}
                      {l.contato_whatsapp && <span className="text-muted-foreground ml-2">WhatsApp: {formatWhatsApp(l.contato_whatsapp)}</span>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => {
                        // Abrir documentos do primeiro sindicato que tiver
                        const target = p || l;
                        if (target) abrirDocDialog(target);
                      }}
                    >
                      <FileText className="size-4 mr-1" /> Documentos
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => {
                        const target = p || l;
                        if (target) abrirEdicao(target);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-red-500"
                      onClick={() => setConfirmDelete({ patronal: p, laboral: l })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* === DIALOG UNIFICADO (Patronal + Laboral + uploads) === */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando.patronal || editando.laboral ? "Editar Ficha" : "Nova Ficha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* ---- Patronal ---- */}
            <div className="space-y-4 border-b border-border pb-6">
              <h3 className="text-lg font-semibold text-primary">Sindicato Patronal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nome *</Label><Input value={patronalForm.nome} onChange={e => setPatronalForm({ ...patronalForm, nome: e.target.value })} placeholder="Nome" /></div>
                <div className="space-y-2"><Label>CNPJ</Label><Input value={patronalForm.cnpj} onChange={handleCNPJChange(setPatronalForm, "cnpj")} placeholder="00.000.000/0000-00" maxLength={18} /></div>
              </div>
              <div className="space-y-2"><Label>WhatsApp</Label><Input value={patronalForm.contato_whatsapp} onChange={handleWhatsAppChange(setPatronalForm, "contato_whatsapp")} placeholder="(62) 99999-9999" maxLength={15} /></div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Unidades Representadas *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {unidades.map(un => (
                    <div key={un.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleUnidade(un.id)} className={cn("size-5 rounded border-2 flex items-center justify-center", unidadesSelecionadas.includes(un.id) ? "bg-primary border-primary text-white" : "border-muted-foreground/30")}>
                        {unidadesSelecionadas.includes(un.id) && <Check className="size-3" />}
                      </button>
                      <Label className="text-sm cursor-pointer">{un.nome}</Label>
                    </div>
                  ))}
                </div>
                {unidadesSelecionadas.length === 0 && <p className="text-xs text-red-500">* Selecione pelo menos uma unidade</p>}
              </div>
              {/* Upload ACT/CCT para Patronal */}
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="font-medium">Anexar ACT/CCT (opcional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Ano</Label>
                    <Input type="number" value={patronalForm.ano} onChange={e => setPatronalForm({ ...patronalForm, ano: parseInt(e.target.value) || new Date().getFullYear() })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={patronalForm.tipo_documento} onValueChange={(v: any) => setPatronalForm({ ...patronalForm, tipo_documento: v })}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Input type="file" accept=".pdf" onChange={e => setPatronalForm({ ...patronalForm, arquivo: e.target.files?.[0] || null })} />
                {patronalForm.arquivo && <p className="text-xs text-muted-foreground">{patronalForm.arquivo.name}</p>}
              </div>
            </div>

            {/* ---- Laboral ---- */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary">Sindicato Laboral</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nome *</Label><Input value={laboralForm.nome} onChange={e => setLaboralForm({ ...laboralForm, nome: e.target.value })} placeholder="Nome" /></div>
                <div className="space-y-2"><Label>CNPJ</Label><Input value={laboralForm.cnpj} onChange={handleCNPJChange(setLaboralForm, "cnpj")} placeholder="00.000.000/0000-00" maxLength={18} /></div>
              </div>
              <div className="space-y-2"><Label>WhatsApp</Label><Input value={laboralForm.contato_whatsapp} onChange={handleWhatsAppChange(setLaboralForm, "contato_whatsapp")} placeholder="(62) 99999-9999" maxLength={15} /></div>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Cargos Representados *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {cargos.map(cg => (
                    <div key={cg.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleCargo(cg.id)} className={cn("size-5 rounded border-2 flex items-center justify-center", cargosSelecionados.includes(cg.id) ? "bg-primary border-primary text-white" : "border-muted-foreground/30")}>
                        {cargosSelecionados.includes(cg.id) && <Check className="size-3" />}
                      </button>
                      <Label className="text-sm cursor-pointer">{cg.nome}</Label>
                    </div>
                  ))}
                </div>
                {cargosSelecionados.length === 0 && <p className="text-xs text-red-500">* Selecione pelo menos um cargo</p>}
              </div>
              {/* Upload ACT/CCT para Laboral */}
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="font-medium">Anexar ACT/CCT (opcional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Ano</Label>
                    <Input type="number" value={laboralForm.ano} onChange={e => setLaboralForm({ ...laboralForm, ano: parseInt(e.target.value) || new Date().getFullYear() })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={laboralForm.tipo_documento} onValueChange={(v: any) => setLaboralForm({ ...laboralForm, tipo_documento: v })}>
                      <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Input type="file" accept=".pdf" onChange={e => setLaboralForm({ ...laboralForm, arquivo: e.target.files?.[0] || null })} />
                {laboralForm.arquivo && <p className="text-xs text-muted-foreground">{laboralForm.arquivo.name}</p>}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarFichaUnificada} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editando.patronal || editando.laboral ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DIÁLOGO DE DOCUMENTOS (gerenciamento) === */}
      <Dialog open={docDialogOpen} onOpenChange={open => !open && setDocDialogOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              Documentos - {sindicatoSelecionado?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="border border-dashed rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Ano</Label><Input type="number" value={docForm.ano} onChange={e => setDocForm({ ...docForm, ano: parseInt(e.target.value) || new Date().getFullYear() })} /></div>
              <div className="space-y-2"><Label>Tipo</Label><Select value={docForm.tipo_documento} onValueChange={(v: any) => setDocForm({ ...docForm, tipo_documento: v })}><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger><SelectContent>{TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <Input type="file" accept=".pdf" onChange={e => setDocForm({ ...docForm, arquivo: e.target.files?.[0] || null })} />
            {docForm.arquivo && <p className="text-xs text-muted-foreground">{docForm.arquivo.name}</p>}
            <Button onClick={uploadDocumento} disabled={uploadingDoc}>{uploadingDoc ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4 mr-1" />} Anexar</Button>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Documentos Anexados</h4>
            {loadingDocs ? <div className="flex justify-center p-4"><Loader2 className="size-6 animate-spin" /></div>
            : documentos.length === 0 ? <div className="text-center text-muted-foreground p-4">Nenhum documento.</div>
            : documentos.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div><div className="font-medium">{getDocTipoLabel(doc.tipo_documento)}</div><div className="text-sm text-muted-foreground">{doc.ano} • {doc.nome_pdf || "PDF"}</div></div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handlePreview(doc)}><Eye className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => handleDownload(doc)}><Download className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => setDeletingDoc(doc)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setDocDialogOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de par */}
      <AlertDialog open={!!confirmDelete.patronal || !!confirmDelete.laboral} onOpenChange={o => !o && setConfirmDelete({ patronal: null, laboral: null })}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir ambos os sindicatos?</AlertDialogTitle><AlertDialogDescription>Isso removerá também os documentos. Ação irreversível.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirPar} className="bg-red-600 text-white hover:bg-red-700">{busy ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão de documento */}
      <AlertDialog open={!!deletingDoc} onOpenChange={o => !o && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir documento?</AlertDialogTitle><AlertDialogDescription>Ação irreversível.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirDocumento} className="bg-red-600 text-white hover:bg-red-700">Excluir</AlertDialogAction>
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