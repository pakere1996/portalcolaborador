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
  Check,
  X,
  Users,
  Briefcase,
} from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { cn } from "@/lib/utils";

// Formatação
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

// Interfaces
interface Sindicato {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: "laboral" | "patronal";
  contato_whatsapp: string | null;
  par_id: string | null;
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

// Agrupamento de par
interface ParSindicato {
  parId: string;
  patronal?: Sindicato;
  laboral?: Sindicato;
  documentos?: DocumentoSindicato[];
}

const TIPOS_DOCUMENTO = [
  { value: "act", label: "ACT (Acordo Coletivo)" },
  { value: "cct", label: "CCT (Convenção Coletiva)" },
];

export default function Sindicatos() {
  const [pares, setPares] = useState<ParSindicato[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Dialog de cadastro/edição do par
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editandoParId, setEditandoParId] = useState<string | null>(null);
  // Dados do formulário do par
  const [form, setForm] = useState({
    patronal: {
      nome: "",
      cnpj: "",
      whatsapp: "",
      unidades: [] as string[], // IDs das unidades selecionadas
    },
    laboral: {
      nome: "",
      cnpj: "",
      whatsapp: "",
      cargos: [] as string[], // IDs dos cargos selecionados
    },
  });

  // Dialog de documentos (para um sindicato específico)
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [sindicatoDoc, setSindicatoDoc] = useState<Sindicato | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoSindicato[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docForm, setDocForm] = useState({
    ano: new Date().getFullYear(),
    tipo_documento: "act" as "act" | "cct",
    arquivo: null as File | null,
  });
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<DocumentoSindicato | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Filtros
  const [filtroNome, setFiltroNome] = useState("");

  // Carregar dados
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sindRes, unidRes, cargoRes] = await Promise.all([
        supabase.from("sindicatos").select("*").order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
      ]);
      if (sindRes.error) throw sindRes.error;
      if (unidRes.error) throw unidRes.error;
      if (cargoRes.error) throw cargoRes.error;

      setUnidades(unidRes.data ?? []);
      setCargos(cargoRes.data ?? []);

      // Agrupar sindicatos por par_id
      const sindicatos = sindRes.data as Sindicato[];
      const grupos = new Map<string, ParSindicato>();
      const semPar = sindicatos.filter(s => !s.par_id);
      // Para os que têm par_id, agrupar
      sindicatos.filter(s => s.par_id).forEach(s => {
        const key = s.par_id!;
        if (!grupos.has(key)) {
          grupos.set(key, { parId: key });
        }
        const grupo = grupos.get(key)!;
        if (s.tipo === "patronal") grupo.patronal = s;
        else if (s.tipo === "laboral") grupo.laboral = s;
      });
      // Adicionar os sem par como grupos individuais (apenas um sindicato)
      semPar.forEach(s => {
        const key = s.id;
        const grupo: ParSindicato = { parId: key };
        if (s.tipo === "patronal") grupo.patronal = s;
        else grupo.laboral = s;
        grupos.set(key, grupo);
      });

      // Buscar documentos para cada sindicato (opcional, pode carregar sob demanda)
      // Vamos carregar apenas para exibição resumida (quantidade)
      // Para simplificar, não carregamos documentos agora, apenas na abertura do dialog

      setPares(Array.from(grupos.values()));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carregar documentos de um sindicato específico
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
      console.error(error);
      toast.error("Erro ao carregar documentos");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // Abrir dialog de documentos
  const abrirDocDialog = (sindicato: Sindicato) => {
    setSindicatoDoc(sindicato);
    setDocForm({ ano: new Date().getFullYear(), tipo_documento: "act", arquivo: null });
    setDocDialogOpen(true);
    loadDocumentos(sindicato.id);
  };

  // Handlers de formatação
  const handlePatronalCNPJ = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      patronal: { ...form.patronal, cnpj: formatCNPJ(e.target.value) }
    });
  };
  const handlePatronalWhatsApp = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      patronal: { ...form.patronal, whatsapp: formatWhatsApp(e.target.value) }
    });
  };
  const handleLaboralCNPJ = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      laboral: { ...form.laboral, cnpj: formatCNPJ(e.target.value) }
    });
  };
  const handleLaboralWhatsApp = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({
      ...form,
      laboral: { ...form.laboral, whatsapp: formatWhatsApp(e.target.value) }
    });
  };

  // Toggle seleção de unidades/cargos
  const toggleUnidade = (unidadeId: string) => {
    const current = form.patronal.unidades;
    const updated = current.includes(unidadeId)
      ? current.filter(id => id !== unidadeId)
      : [...current, unidadeId];
    setForm({ ...form, patronal: { ...form.patronal, unidades: updated } });
  };
  const toggleCargo = (cargoId: string) => {
    const current = form.laboral.cargos;
    const updated = current.includes(cargoId)
      ? current.filter(id => id !== cargoId)
      : [...current, cargoId];
    setForm({ ...form, laboral: { ...form.laboral, cargos: updated } });
  };

  // Salvar par (cria/atualiza patronal e laboral)
  const salvarPar = async () => {
    // Validações
    if (!form.patronal.nome.trim()) return toast.error("Nome do sindicato patronal é obrigatório");
    if (!form.laboral.nome.trim()) return toast.error("Nome do sindicato laboral é obrigatório");
    if (form.patronal.unidades.length === 0) return toast.error("Selecione pelo menos uma unidade para o patronal");
    if (form.laboral.cargos.length === 0) return toast.error("Selecione pelo menos um cargo para o laboral");

    setBusy(true);
    try {
      const parId = editandoParId || crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

      // Dados dos sindicatos
      const patronalData = {
        nome: form.patronal.nome.trim(),
        cnpj: form.patronal.cnpj ? onlyNumbers(form.patronal.cnpj) : null,
        tipo: "patronal" as const,
        contato_whatsapp: form.patronal.whatsapp ? onlyNumbers(form.patronal.whatsapp) : null,
        par_id: parId,
        updated_at: new Date().toISOString(),
      };
      const laboralData = {
        nome: form.laboral.nome.trim(),
        cnpj: form.laboral.cnpj ? onlyNumbers(form.laboral.cnpj) : null,
        tipo: "laboral" as const,
        contato_whatsapp: form.laboral.whatsapp ? onlyNumbers(form.laboral.whatsapp) : null,
        par_id: parId,
        updated_at: new Date().toISOString(),
      };

      let patronalId: string, laboralId: string;

      if (editandoParId) {
        // Buscar IDs existentes
        const { data: existing } = await supabase
          .from("sindicatos")
          .select("id, tipo")
          .eq("par_id", editandoParId);
        const patronalExist = existing?.find(s => s.tipo === "patronal");
        const laboralExist = existing?.find(s => s.tipo === "laboral");

        // Atualizar ou inserir
        if (patronalExist) {
          await supabase.from("sindicatos").update(patronalData).eq("id", patronalExist.id);
          patronalId = patronalExist.id;
        } else {
          const { data } = await supabase.from("sindicatos").insert(patronalData).select("id").single();
          patronalId = data.id;
        }
        if (laboralExist) {
          await supabase.from("sindicatos").update(laboralData).eq("id", laboralExist.id);
          laboralId = laboralExist.id;
        } else {
          const { data } = await supabase.from("sindicatos").insert(laboralData).select("id").single();
          laboralId = data.id;
        }

        // Remover vínculos antigos e reinserir
        await supabase.from("sindicato_unidades").delete().eq("sindicato_id", patronalId);
        await supabase.from("sindicato_cargos").delete().eq("sindicato_id", laboralId);
      } else {
        // Inserir ambos com o mesmo par_id
        const [pRes, lRes] = await Promise.all([
          supabase.from("sindicatos").insert(patronalData).select("id").single(),
          supabase.from("sindicatos").insert(laboralData).select("id").single(),
        ]);
        if (pRes.error) throw pRes.error;
        if (lRes.error) throw lRes.error;
        patronalId = pRes.data.id;
        laboralId = lRes.data.id;
      }

      // Inserir vínculos
      if (form.patronal.unidades.length > 0) {
        const inserts = form.patronal.unidades.map(unidadeId => ({
          sindicato_id: patronalId,
          unidade_id: unidadeId,
        }));
        await supabase.from("sindicato_unidades").insert(inserts);
      }
      if (form.laboral.cargos.length > 0) {
        const inserts = form.laboral.cargos.map(cargoId => ({
          sindicato_id: laboralId,
          cargo_id: cargoId,
        }));
        await supabase.from("sindicato_cargos").insert(inserts);
      }

      toast.success(editandoParId ? "Par de sindicatos atualizado!" : "Par de sindicatos criado!");
      setDialogOpen(false);
      setEditandoParId(null);
      setForm({
        patronal: { nome: "", cnpj: "", whatsapp: "", unidades: [] },
        laboral: { nome: "", cnpj: "", whatsapp: "", cargos: [] },
      });
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Excluir par (remove ambos os sindicatos e documentos)
  const excluirPar = async (parId: string) => {
    setBusy(true);
    try {
      // Buscar sindicatos do par
      const { data: sinds } = await supabase
        .from("sindicatos")
        .select("id")
        .eq("par_id", parId);
      if (sinds && sinds.length > 0) {
        const ids = sinds.map(s => s.id);
        // Remover documentos do storage
        const { data: docs } = await supabase
          .from("documentos_sindicato")
          .select("storage_path")
          .in("sindicato_id", ids);
        if (docs && docs.length > 0) {
          const paths = docs.map(d => d.storage_path);
          await supabase.storage.from("sindicatos").remove(paths);
        }
        // Deletar sindicatos (cascade deleta vínculos e documentos)
        await supabase.from("sindicatos").delete().in("id", ids);
      }
      toast.success("Par de sindicatos excluído!");
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // Editar par: carregar dados
  const editarPar = async (parId: string) => {
    const { data: sinds } = await supabase
      .from("sindicatos")
      .select("*")
      .eq("par_id", parId);
    if (!sinds || sinds.length === 0) return;

    const patronal = sinds.find(s => s.tipo === "patronal");
    const laboral = sinds.find(s => s.tipo === "laboral");
    if (!patronal || !laboral) {
      toast.error("Par incompleto, não é possível editar");
      return;
    }

    // Carregar vínculos
    const [unidadesRes, cargosRes] = await Promise.all([
      supabase.from("sindicato_unidades").select("unidade_id").eq("sindicato_id", patronal.id),
      supabase.from("sindicato_cargos").select("cargo_id").eq("sindicato_id", laboral.id),
    ]);

    setEditandoParId(parId);
    setForm({
      patronal: {
        nome: patronal.nome,
        cnpj: patronal.cnpj ? formatCNPJ(patronal.cnpj) : "",
        whatsapp: patronal.contato_whatsapp ? formatWhatsApp(patronal.contato_whatsapp) : "",
        unidades: unidadesRes.data?.map(u => u.unidade_id) ?? [],
      },
      laboral: {
        nome: laboral.nome,
        cnpj: laboral.cnpj ? formatCNPJ(laboral.cnpj) : "",
        whatsapp: laboral.contato_whatsapp ? formatWhatsApp(laboral.contato_whatsapp) : "",
        cargos: cargosRes.data?.map(c => c.cargo_id) ?? [],
      },
    });
    setDialogOpen(true);
  };

  // Upload de documento
  const uploadDocumento = async () => {
    if (!sindicatoDoc || !docForm.arquivo) {
      toast.error("Selecione um arquivo");
      return;
    }
    setUploadingDoc(true);
    try {
      const path = `sindicato_${sindicatoDoc.id}/${docForm.tipo_documento}_${docForm.ano}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("sindicatos")
        .upload(path, docForm.arquivo, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;

      await supabase.from("documentos_sindicato").insert({
        sindicato_id: sindicatoDoc.id,
        ano: docForm.ano,
        tipo_documento: docForm.tipo_documento,
        storage_path: path,
        nome_pdf: docForm.arquivo.name,
      });
      toast.success("Documento anexado!");
      setDocForm({ ...docForm, arquivo: null });
      loadDocumentos(sindicatoDoc.id);
    } catch (error) {
      console.error(error);
      toast.error("Erro no upload", { description: (error as Error).message });
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
      if (sindicatoDoc) loadDocumentos(sindicatoDoc.id);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir documento");
    }
  };

  const handleDownload = async (doc: DocumentoSindicato) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link");
  };

  const handlePreview = async (doc: DocumentoSindicato) => {
    const { data } = await supabase.storage
      .from("sindicatos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else toast.error("Erro ao gerar preview");
  };

  // Filtro
  const filteredPares = useMemo(() => {
    return pares.filter(p => {
      const nome = p.patronal?.nome || p.laboral?.nome || "";
      return nome.toLowerCase().includes(filtroNome.toLowerCase());
    });
  }, [pares, filtroNome]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Sindicatos
          </h1>
          <p className="text-muted-foreground">Cadastre pares de sindicatos (Patronal + Laboral) com vínculos.</p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao rota="/admin/sindicatos" label="Sindicatos" icone="Building2" />
          <Button onClick={() => {
            setEditandoParId(null);
            setForm({
              patronal: { nome: "", cnpj: "", whatsapp: "", unidades: [] },
              laboral: { nome: "", cnpj: "", whatsapp: "", cargos: [] },
            });
            setDialogOpen(true);
          }}>
            <Plus className="size-4 mr-2" /> Novo Par
          </Button>
        </div>
      </div>

      {/* Filtro */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nome..."
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
          />
        </div>
        <Button variant="ghost" onClick={() => setFiltroNome("")}>Limpar</Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="size-8 animate-spin" /></div>
      ) : filteredPares.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-2xl text-muted-foreground">
          Nenhum par de sindicatos cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPares.map((par) => (
            <Card key={par.parId} className="border-border shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {par.patronal && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">Patronal</Badge>
                    )}
                    {par.laboral && (
                      <Badge variant="default" className="bg-green-100 text-green-700">Laboral</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => editarPar(par.parId)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => excluirPar(par.parId)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {par.patronal && (
                  <div>
                    <div className="font-semibold text-sm">Patronal</div>
                    <div className="text-sm">{par.patronal.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {par.patronal.cnpj && `CNPJ: ${formatCNPJ(par.patronal.cnpj)}`}
                      {par.patronal.contato_whatsapp && ` • WhatsApp: ${formatWhatsApp(par.patronal.contato_whatsapp)}`}
                    </div>
                    <Button variant="link" size="sm" className="px-0 h-auto text-blue-600" onClick={() => abrirDocDialog(par.patronal!)}>
                      <FileText className="size-3 mr-1" /> Documentos
                    </Button>
                  </div>
                )}
                {par.laboral && (
                  <div>
                    <div className="font-semibold text-sm">Laboral</div>
                    <div className="text-sm">{par.laboral.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {par.laboral.cnpj && `CNPJ: ${formatCNPJ(par.laboral.cnpj)}`}
                      {par.laboral.contato_whatsapp && ` • WhatsApp: ${formatWhatsApp(par.laboral.contato_whatsapp)}`}
                    </div>
                    <Button variant="link" size="sm" className="px-0 h-auto text-blue-600" onClick={() => abrirDocDialog(par.laboral!)}>
                      <FileText className="size-3 mr-1" /> Documentos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de cadastro/edição do par */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoParId ? "Editar Par de Sindicatos" : "Novo Par de Sindicatos"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Bloco Patronal */}
            <div className="border rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-primary flex items-center gap-2"><Building2 className="size-4" /> Sindicato Patronal</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input
                    value={form.patronal.nome}
                    onChange={(e) => setForm({ ...form, patronal: { ...form.patronal, nome: e.target.value } })}
                    placeholder="Ex: Sindicato Patronal..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ</Label>
                  <Input value={form.patronal.cnpj} onChange={handlePatronalCNPJ} placeholder="00.000.000/0000-00" maxLength={18} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.patronal.whatsapp} onChange={handlePatronalWhatsApp} placeholder="(62) 99999-9999" maxLength={15} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unidades Representadas *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {unidades.map(u => (
                    <div key={u.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleUnidade(u.id)} className={cn(
                        "size-5 rounded border-2 flex items-center justify-center",
                        form.patronal.unidades.includes(u.id) ? "bg-primary border-primary text-white" : "border-muted-foreground/30"
                      )}>
                        {form.patronal.unidades.includes(u.id) && <Check className="size-3" />}
                      </button>
                      <Label className="text-sm cursor-pointer">{u.nome}</Label>
                    </div>
                  ))}
                </div>
                {form.patronal.unidades.length === 0 && <p className="text-xs text-red-500">* Selecione pelo menos uma unidade</p>}
              </div>
            </div>

            {/* Bloco Laboral */}
            <div className="border rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-primary flex items-center gap-2"><Users className="size-4" /> Sindicato Laboral</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input
                    value={form.laboral.nome}
                    onChange={(e) => setForm({ ...form, laboral: { ...form.laboral, nome: e.target.value } })}
                    placeholder="Ex: Sindicato Laboral..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ</Label>
                  <Input value={form.laboral.cnpj} onChange={handleLaboralCNPJ} placeholder="00.000.000/0000-00" maxLength={18} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>WhatsApp</Label>
                  <Input value={form.laboral.whatsapp} onChange={handleLaboralWhatsApp} placeholder="(62) 99999-9999" maxLength={15} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cargos Representados *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                  {cargos.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleCargo(c.id)} className={cn(
                        "size-5 rounded border-2 flex items-center justify-center",
                        form.laboral.cargos.includes(c.id) ? "bg-primary border-primary text-white" : "border-muted-foreground/30"
                      )}>
                        {form.laboral.cargos.includes(c.id) && <Check className="size-3" />}
                      </button>
                      <Label className="text-sm cursor-pointer">{c.nome}</Label>
                    </div>
                  ))}
                </div>
                {form.laboral.cargos.length === 0 && <p className="text-xs text-red-500">* Selecione pelo menos um cargo</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarPar} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editandoParId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de documentos (mantido) */}
      <Dialog open={docDialogOpen} onOpenChange={(open) => {
        if (!open) { setDocDialogOpen(false); setSindicatoDoc(null); setDocumentos([]); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-primary" /> Documentos - {sindicatoDoc?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="border border-dashed rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Ano *</Label>
                <Input type="number" value={docForm.ano} onChange={(e) => setDocForm({ ...docForm, ano: parseInt(e.target.value) || new Date().getFullYear() })} />
              </div>
              <div className="space-y-1">
                <Label>Tipo *</Label>
                <Select value={docForm.tipo_documento} onValueChange={(v) => setDocForm({ ...docForm, tipo_documento: v as "act" | "cct" })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Arquivo (PDF) *</Label>
              <Input type="file" accept=".pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) setDocForm({ ...docForm, arquivo: file }); }} />
              {docForm.arquivo && <p className="text-xs text-muted-foreground">{docForm.arquivo.name} ({(docForm.arquivo.size/1024).toFixed(1)} KB)</p>}
            </div>
            <Button onClick={uploadDocumento} disabled={uploadingDoc}>
              {uploadingDoc ? <Loader2 className="size-4 animate-spin mr-1" /> : <Upload className="size-4 mr-1" />} Anexar
            </Button>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Documentos Anexados</h4>
            {loadingDocs ? (
              <div className="flex justify-center p-4"><Loader2 className="size-6 animate-spin" /></div>
            ) : documentos.length === 0 ? (
              <div className="text-center p-4 text-muted-foreground">Nenhum documento anexado.</div>
            ) : (
              <div className="space-y-2">
                {documentos.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">{doc.tipo_documento.toUpperCase()}</div>
                      <div className="text-sm text-muted-foreground">{doc.ano} • {doc.nome_pdf || "PDF"}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)}><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}><Download className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeletingDoc(doc)}><Trash2 className="size-4" /></Button>
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

      {/* Confirmações de exclusão */}
      <AlertDialog open={!!deletingDoc} onOpenChange={(o) => !o && setDeletingDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir documento?</AlertDialogTitle><AlertDialogDescription>Ação irreversível.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirDocumento} className="bg-red-600">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Visualização</DialogTitle></DialogHeader>
          <div className="min-h-[500px] bg-muted/20 rounded-lg">
            {previewUrl ? <iframe src={previewUrl} className="w-full h-[600px] border-0" /> : <div className="flex justify-center p-12">Carregando...</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </AlertDialog>
    </div>
  );
}