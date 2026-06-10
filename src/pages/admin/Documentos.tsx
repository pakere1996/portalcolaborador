import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Download,
  Trash2,
  CalendarClock,
  UserPlus,
  Ban,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  Documento,
  Profile,
  PageResult,
  UploadStats,
  extractPdfText,
  findBestProfileMatch,
  guessNameFromText,
  createMergedPdf,
  getDocumentStoragePath,
  getPendingDocumentStoragePath,
  DocumentType,
  detectReferencePeriod,
  buildMonthlyHistory,
  findDuplicateDocuments,
  getDocumentTypeLabel,
  syncAdminMonthlyDocumentReminder,
  extractStructuredData, // Nova função
  ExtractedData, // Nova interface
} from "@/lib/documentos";
import { Tables } from "@/integrations/supabase/types";
import { ColaboradorFormDialog, InitialData } from "@/components/ColaboradorFormDialog"; // Importação atualizada

const routeTypeMap: Record<string, DocumentType> = {
  "/admin/documentos": "contracheque",
  "/admin/documentos/ponto": "folha_ponto",
};

type SuggestedProfile = Tables<'suggested_profiles'>;
type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;

function getEmptyStats(): UploadStats {
  return { auto: 0, manual: 0, pending: 0, total: 0 };
}

export default function AdminDocumentosPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeType = routeTypeMap[location.pathname] ?? "contracheque";

  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<DocumentType>(routeType);
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [draftMes, setDraftMes] = useState("");
  const [draftAno, setDraftAno] = useState("");
  const [isEditingReference, setIsEditingReference] = useState(false);
  
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);

  const [docs, setDocs] = useState<Documento[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [manualProfileByPage, setManualProfileByPage] = useState<Record<number, string>>({});
  const [identifiedNames, setIdentifiedNames] = useState<Record<number, string>>({});
  const [stats, setStats] = useState<UploadStats>(getEmptyStats());
  const [showResults, setShowResults] = useState(false);
  const [duplicateDocs, setDuplicateDocs] = useState<Documento[]>([]);
  const [pendingSave, setPendingSave] = useState(false);
  const [detectedReference, setDetectedReference] = useState("");
  const [ignoredPages, setIgnoredPages] = useState<Record<number, boolean>>({});
  const [pageToIgnore, setPageToIgnore] = useState<number | null>(null);

  // State para o novo fluxo de pré-cadastro
  const [suggestedProfiles, setSuggestedProfiles] = useState<SuggestedProfile[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestedProfile | null>(null);
  const [selectedPageResult, setSelectedPageResult] = useState<PageResult | null>(null); // Novo estado para cadastro imediato
  const [openPreCadastroDialog, setOpenPreCadastroDialog] = useState(false);

  useEffect(() => {
    setTipo(routeType);
    setShowResults(false);
    setDuplicateDocs([]);
    setPageResults([]);
    setManualProfileByPage({});
    setIdentifiedNames({});
    setIgnoredPages({});
    setPageToIgnore(null);
    setIsEditingReference(false);
  }, [routeType]);

  useEffect(() => {
    loadData();
  }, [tipo]);

  const loadData = async () => {
    try {
      const [profilesRes, docsRes, suggestedRes, unidadesRes, cargosRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, cpf").eq("ativo", true).order("nome"),
        supabase.from("documentos").select("*").eq("tipo", tipo).order("created_at", { ascending: false }),
        supabase.from("suggested_profiles").select("*").eq("status", "pending").order("created_at", { ascending: false }),
        supabase.from("unidades").select("*").order("nome"),
        supabase.from("cargos").select("*").order("nome"),
      ]);

      setProfiles((profilesRes.data ?? []) as Profile[]);
      setUnidades((unidadesRes.data ?? []) as Unidade[]);
      setCargos((cargosRes.data ?? []) as Cargo[]);

      const docsList = (docsRes.data ?? []) as Documento[];
      setDocs(docsList);
      updateStats(docsList);
      setSuggestedProfiles((suggestedRes.data ?? []) as SuggestedProfile[]);
      await syncAdminMonthlyDocumentReminder();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados");
    }
  };

  const updateStats = (docsList: Documento[]) => {
    const nextStats = getEmptyStats();
    nextStats.total = docsList.length;

    docsList.forEach((doc) => {
      if (doc.status === "pendente") {
        nextStats.pending += 1;
      } else {
        nextStats.auto += 1;
      }
    });

    setStats(nextStats);
  };

  const monthlyHistory = useMemo(() => buildMonthlyHistory(docs, tipo, 12), [docs, tipo]);

  const handleRouteTypeChange = (value: DocumentType) => {
    navigate(value === "contracheque" ? "/admin/documentos" : "/admin/documentos/ponto");
  };

  const resetResultsState = () => {
    setShowResults(false);
    setPageResults([]);
    setManualProfileByPage({});
    setIdentifiedNames({});
    setDuplicateDocs([]);
    setPendingSave(false);
    setIgnoredPages({});
    setPageToIgnore(null);
  };

  const resetUploadState = () => {
    setFile(null);
    resetResultsState();
    setDetectedReference("");
    setMes("");
    setAno("");
    setDraftMes("");
    setDraftAno("");
    setIsEditingReference(false);
  };

  const handleStartReferenceEdit = () => {
    setDraftMes(mes);
    setDraftAno(ano);
    setIsEditingReference(true);
  };

  const handleConfirmReferenceEdit = () => {
    if (!draftMes || !draftAno) {
      toast.error("Preencha mês e ano");
      return;
    }

    setMes(draftMes);
    setAno(draftAno);
    setDetectedReference(`Corrigido manualmente para ${String(draftMes).padStart(2, "0")}/${draftAno}`);
    setIsEditingReference(false);
    toast.success("Período corrigido");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || selectedFile.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF válido");
      return;
    }

    setFile(selectedFile);
    resetResultsState(); // Resetar apenas os resultados, mantendo o período se já estiver setado

    // Resetar o período de referência para forçar a re-detecção ou entrada manual
    setMes("");
    setAno("");
    setDraftMes("");
    setDraftAno("");
    setDetectedReference("");
    setIsEditingReference(false);

    try {
      const pages = await extractPdfText(selectedFile);
      const combinedText = pages.map((page) => page.text).join(" ");
      const detected = detectReferencePeriod(combinedText, tipo);

      if (detected) {
        const nextMes = String(detected.mes);
        const nextAno = String(detected.ano);
        setMes(nextMes);
        setAno(nextAno);
        setDraftMes(nextMes);
        setDraftAno(nextAno);
        setDetectedReference(detected.sourceText);
        toast.success("Mês e ano preenchidos automaticamente");
      } else {
        setIsEditingReference(true);
        toast.warning("Não foi possível identificar o mês e ano automaticamente");
      }
    } catch {
      setIsEditingReference(true);
      toast.warning("Não foi possível identificar o mês e ano automaticamente");
    }
  };

  const processPdf = useCallback(async () => {
    if (!file || !tipo || !mes || !ano) {
      toast.error("Preencha todos os campos");
      return;
    }

    setProcessing(true);
    try {
      const duplicates = await findDuplicateDocuments(tipo, Number(mes), Number(ano));
      setDuplicateDocs(duplicates);

      const pages = await extractPdfText(file);
      const results: PageResult[] = [];

      for (const page of pages) {
        const match = findBestProfileMatch(page.text, profiles);
        const extractedData = extractStructuredData(page.text);

        if (match) {
          results.push({
            pageNumber: page.pageNumber,
            text: page.text,
            status: "auto",
            profileId: match.profile.id,
            profileName: match.profile.nome,
            score: match.score,
            identifiedName: match.profile.nome,
            extractedData: extractedData,
          });
        } else {
          // Colaborador não encontrado, sugerir pré-cadastro
          results.push({
            pageNumber: page.pageNumber,
            text: page.text,
            status: "suggested", // Novo status para pré-cadastro
            identifiedName: extractedData.nome || guessNameFromText(page.text, tipo),
            extractedData: extractedData,
          });
        }
      }

      setPageResults(results);
      setShowResults(true);
      setIgnoredPages({});

      if (duplicates.length > 0) {
        toast.warning("Já existem documentos deste tipo para este mês/ano");
      } else {
        toast.success("PDF processado com sucesso");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar PDF");
    } finally {
      setProcessing(false);
    }
  }, [file, tipo, mes, ano, profiles]);

  const handleManualAssign = (pageNumber: number, profileId: string) => {
    setIgnoredPages((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });

    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      setManualProfileByPage((prev) => ({
        ...prev,
        [pageNumber]: profileId,
      }));
      setIdentifiedNames((prev) => ({
        ...prev,
        [pageNumber]: profile.nome,
      }));
      setPageResults((prev) =>
        prev.map((page) =>
          page.pageNumber === pageNumber
            ? { ...page, status: "manual", profileId, profileName: profile.nome, identifiedName: profile.nome }
            : page,
        ),
      );
    }
  };

  const handleNameChange = (pageNumber: number, name: string) => {
    setIdentifiedNames((prev) => ({
      ...prev,
      [pageNumber]: name,
    }));

    setPageResults((prev) =>
      prev.map((page) =>
        page.pageNumber === pageNumber
          ? { ...page, identifiedName: name }
          : page,
      ),
    );
  };

  const confirmIgnorePage = () => {
    if (pageToIgnore === null) return;

    const pageNumber = pageToIgnore;

    setIgnoredPages((prev) => ({
      ...prev,
      [pageNumber]: true,
    }));
    setManualProfileByPage((prev) => {
      const next = { ...prev };
      delete next[pageNumber];
      return next;
    });
    setPageResults((prev) =>
      prev.map((page) =>
        page.pageNumber === pageNumber
          ? { ...page, status: "suggested" } // Volta para suggested se for ignorado
          : page,
      ),
    );
    setPageToIgnore(null);
    toast.success(`Página ${pageNumber} ignorada`);
  };

  const persistDocuments = async () => {
    if (!file || !tipo || !mes || !ano) return;

    setProcessing(true);
    const newStats = getEmptyStats();
    const suggestionsToSave: Tables<'suggested_profiles'>['Insert'][] = [];

    try {
      const groups: Record<string, PageResult[]> = {};

      for (const page of pageResults) {
        if (ignoredPages[page.pageNumber]) {
          continue;
        }

        let key: string;
        let profileId: string | null = null;
        let status: "auto" | "manual" | "suggested" | "linked" = page.status as any;

        if (status === "auto" || (status === "manual" && manualProfileByPage[page.pageNumber])) {
          profileId = status === "auto" ? page.profileId! : manualProfileByPage[page.pageNumber];
          key = `profile:${profileId}`;
        } else if (status === "linked") {
          // Colaborador cadastrado imediatamente, já temos o ID
          profileId = page.profileId!;
          key = `profile:${profileId}`;
        } else if (status === "suggested") {
          key = `suggested:${page.pageNumber}`;
        } else {
          continue; // Ignora páginas que não são auto, manual, linked ou suggested
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(page);
      }

      if (Object.keys(groups).length === 0) {
        toast.error("Nenhuma página válida para salvar");
        setProcessing(false);
        return;
      }

      if (duplicateDocs.length > 0) {
        const { error: deleteError } = await supabase
          .from("documentos")
          .delete()
          .eq("tipo", tipo)
          .eq("mes", Number(mes))
          .eq("ano", Number(ano));

        if (deleteError) throw deleteError;
      }

      for (const [key, group] of Object.entries(groups)) {
        const isProfileGroup = key.startsWith("profile:");
        const isSuggestedGroup = key.startsWith("suggested:");
        const profileId = isProfileGroup ? key.split(":")[1] : null;
        const pageNumbers = group.map((p) => p.pageNumber);
        const mergedPdf = await createMergedPdf(file, pageNumbers);

        const storagePath = isProfileGroup
          ? getDocumentStoragePath(profileId!, tipo, Number(ano), Number(mes))
          : getPendingDocumentStoragePath(tipo, Number(ano), Number(mes), pageNumbers, group[0].identifiedName);

        // 1. Upload do arquivo
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(storagePath, mergedPdf, {
            contentType: "application/pdf",
            upsert: true,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        // 2. Inserir Documento
        const docPayload = {
          colaborador_id: profileId,
          tipo,
          mes: Number(mes),
          ano: Number(ano),
          storage_path: storagePath,
          status: isProfileGroup ? "vinculado" : "pendente",
          nome_pdf: group[0].identifiedName,
        };

        const { data: docData, error: dbError } = await supabase.from("documentos").insert(docPayload).select("id").single();
        if (dbError) throw dbError;
        
        const documentId = docData.id;

        // 3. Se for sugerido, salvar na suggested_profiles
        if (isSuggestedGroup) {
          suggestionsToSave.push({
            document_id: documentId,
            extracted_data: group[0].extractedData as ExtractedData,
            status: 'pending',
          });
        }

        if (isProfileGroup) {
          if (group.some((item) => item.status === "manual")) {
            newStats.manual += 1;
          } else if (group.some((item) => item.status === "linked")) {
            newStats.manual += 1; // Contabiliza como manual/vinculado
          } else {
            newStats.auto += 1;
          }
        } else {
          newStats.pending += 1;
        }

        newStats.total += 1;
      }

      // Salvar todas as sugestões de perfil
      if (suggestionsToSave.length > 0) {
        const { error: suggestionError } = await supabase.from("suggested_profiles").insert(suggestionsToSave);
        if (suggestionError) throw suggestionError;
      }

      setStats(newStats);
      resetUploadState();
      toast.success("Documentos e sugestões salvos com sucesso");
      await loadData();
      await syncAdminMonthlyDocumentReminder();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar documentos");
    } finally {
      setProcessing(false);
    }
  };

  const saveDecisions = async () => {
    if (duplicateDocs.length > 0) {
      setPendingSave(true);
      return;
    }

    await persistDocuments();
  };

  const handleOpenPreCadastro = (suggestion: SuggestedProfile) => {
    setSelectedSuggestion(suggestion);
    setSelectedPageResult(null);
    setOpenPreCadastroDialog(true);
  };

  const handleOpenPreCadastroImmediate = (page: PageResult) => {
    setSelectedPageResult(page);
    setSelectedSuggestion(null);
    setOpenPreCadastroDialog(true);
  };

  const handlePreCadastroSuccess = (newProfileId?: string, pageNumber?: number) => {
    // Se o cadastro foi feito a partir de um PageResult (cadastro imediato)
    if (newProfileId && pageNumber) {
      const newProfile = profiles.find(p => p.id === newProfileId) || { id: newProfileId, nome: "Novo Colaborador", cpf: "" };
      
      setPageResults(prev => prev.map(page => {
        if (page.pageNumber === pageNumber) {
          return {
            ...page,
            status: "linked", // Novo status: vinculado imediatamente
            profileId: newProfileId,
            profileName: newProfile.nome,
            identifiedName: newProfile.nome,
          };
        }
        return page;
      }));
      
      // Adiciona o novo perfil à lista de perfis para que ele possa ser usado em outras páginas
      setProfiles(prev => [...prev, newProfile as Profile]);
    }
    
    // Recarrega os dados (principalmente para atualizar o painel de sugestões do DB)
    loadData();
  };

  const getStatusBadge = (status: string) => {
    if (status === "vinculado") {
      return <Badge className="bg-green-100 text-green-700 border-green-200">Vinculado</Badge>;
    }
    return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pendente</Badge>;
  };

  const getHistoryBadge = (status: "ok" | "faltando" | "duplicado") => {
    if (status === "ok") return <Badge className="bg-green-100 text-green-700 border-green-200">OK</Badge>;
    if (status === "duplicado") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Duplicado</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200">Faltando</Badge>;
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      const { data: docData, error: docError } = await supabase
        .from("documentos")
        .select("storage_path")
        .eq("id", docId)
        .single();

      if (docError) throw docError;

      if (docData?.storage_path) {
        const { error: storageError } = await supabase.storage.from("documentos").remove([docData.storage_path]);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase.from("documentos").delete().eq("id", docId);
      if (deleteError) throw deleteError;

      toast.success("Documento excluído");
      await loadData();
      await syncAdminMonthlyDocumentReminder();
    } catch {
      toast.error("Erro ao excluir documento");
    }
  };

  const openPreview = async (doc: Documento) => {
    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Erro ao carregar documento");
    }
  };

  const downloadDoc = async (doc: Documento) => {
    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 300);
      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.nome_pdf;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Erro ao baixar documento");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Gestão de {getDocumentTypeLabel(tipo)}
        </h1>
        <p className="text-muted-foreground mt-1">
          Esta rota já filtra automaticamente o tipo correto de documento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="size-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.auto}</div>
            <div className="text-sm text-muted-foreground">Vinculados</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="size-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.manual}</div>
            <div className="text-sm text-muted-foreground">Manuais</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="size-8 text-orange-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pendentes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="size-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Painel de Conferência de Sugestões */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5 text-primary" /> Sugestões de Pré-Cadastro ({suggestedProfiles.length})
            </CardTitle>
            <CardDescription>
              Colaboradores identificados em documentos pendentes que precisam de cadastro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {suggestedProfiles.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma sugestão pendente.</p>
            ) : (
              <div className="space-y-3">
                {suggestedProfiles.map((suggestion) => {
                  const data = suggestion.extracted_data as ExtractedData;
                  return (
                    <div key={suggestion.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                      <div>
                        <div className="font-medium">{data.nome || "Nome não extraído"}</div>
                        <div className="text-sm text-muted-foreground">
                          CPF: {data.cpf || "N/A"} | Cargo: {data.cargo || "N/A"}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleOpenPreCadastro(suggestion)}>
                        <UserPlus className="size-4 mr-2" /> Cadastrar
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload de Documentos</CardTitle>
            <CardDescription>
              O mês e ano serão sugeridos automaticamente pelo texto do PDF, mas continuam editáveis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Tipo de Documento</Label>
                <Select value={tipo} onValueChange={(value: DocumentType) => handleRouteTypeChange(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contracheque">Contracheque</SelectItem>
                    <SelectItem value="folha_ponto">Folha de Ponto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Arquivo PDF</Label>
                <Input type="file" accept=".pdf" onChange={handleFileChange} disabled={processing} />
                {detectedReference && (
                  <p className="text-xs text-muted-foreground">
                    Referência detectada automaticamente: <span className="font-medium">{detectedReference}</span>
                  </p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Período identificado</Label>
                {!isEditingReference ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={mes && ano ? `${String(mes).padStart(2, "0")}/${ano}` : ""}
                      readOnly
                      placeholder="Aguardando identificação do PDF"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleStartReferenceEdit}
                      disabled={!file}
                      className="sm:w-auto"
                    >
                      Corrigir
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Mês</Label>
                        <Select value={draftMes} onValueChange={setDraftMes}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o mês" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>
                                {new Date(2024, i).toLocaleDateString("pt-BR", { month: "long" })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Ano</Label>
                        <Input
                          type="number"
                          value={draftAno}
                          onChange={(e) => setDraftAno(e.target.value)}
                          placeholder="2026"
                          min="2020"
                          max="2035"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={handleConfirmReferenceEdit}>
                        Confirmar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setDraftMes(mes);
                          setDraftAno(ano);
                          setIsEditingReference(false);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {duplicateDocs.length > 0 && (
              <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                Já existem {duplicateDocs.length} documento(s) deste tipo para {String(mes).padStart(2, "0")}/{ano}. Você poderá confirmar a substituição antes de salvar.
              </div>
            )}

            <Button onClick={processPdf} disabled={!file || !mes || !ano || processing || isEditingReference} className="w-full">
              {processing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" /> Processar PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-5 text-primary" /> Histórico mensal
            </CardTitle>
            <CardDescription>
              Verde = ok, vermelho = faltando, amarelo = duplicado.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monthlyHistory.map((item) => (
              <div key={`${item.ano}-${item.mes}`} className="rounded-xl border p-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">
                    {new Date(item.ano, item.mes - 1, 1).toLocaleDateString("pt-BR", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.total} arquivo(s)</div>
                </div>
                {getHistoryBadge(item.status)}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Processamento</CardTitle>
            <CardDescription>
              Revise e confirme o vínculo de cada página antes de salvar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pageResults.map((page) => {
              const isIgnored = !!ignoredPages[page.pageNumber];
              const isAuto = page.status === "auto";
              const isManual = page.status === "manual";
              const isSuggested = page.status === "suggested";
              const isLinked = page.status === "linked"; // Novo status

              let statusBadge;
              if (isAuto) statusBadge = <Badge className="bg-green-100 text-green-700 border-green-200">Vinculado: {page.profileName}</Badge>;
              else if (isManual) statusBadge = <Badge className="bg-blue-100 text-blue-700 border-blue-200">Manual: {identifiedNames[page.pageNumber] || page.profileName}</Badge>;
              else if (isLinked) statusBadge = <Badge className="bg-green-100 text-green-700 border-green-200">Vinculado (Novo): {page.profileName}</Badge>;
              else if (isSuggested) statusBadge = <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pré-Cadastro Sugerido</Badge>;
              else if (isIgnored) statusBadge = <Badge className="bg-slate-100 text-slate-700 border-slate-200">Ignorada</Badge>;

              return (
                <div key={page.pageNumber} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold">Página {page.pageNumber}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                    <p className="font-medium mb-1">Dados extraídos:</p>
                    <p className="italic">Nome: {page.extractedData?.nome || 'N/A'} | CPF: {page.extractedData?.cpf || 'N/A'} | Cargo: {page.extractedData?.cargo || 'N/A'}</p>
                  </div>

                  {(!isAuto && !isLinked && !isIgnored) && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Vincular manualmente a</Label>
                        <Select
                          value={manualProfileByPage[page.pageNumber] || ""}
                          onValueChange={(value) => handleManualAssign(page.pageNumber, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um colaborador existente" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.nome} (CPF: {profile.cpf})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {isSuggested && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => handleOpenPreCadastroImmediate(page)}
                          >
                            <UserPlus className="size-4 mr-2" /> Cadastrar Colaborador
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPageToIgnore(page.pageNumber)}
                          >
                            <Ban className="size-4 mr-2" /> Ignorar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-4 flex-wrap">
              <Button variant="outline" onClick={() => setShowResults(false)}>
                Cancelar
              </Button>
              <Button onClick={saveDecisions} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar documentos e sugestões"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documentos cadastrados</CardTitle>
          <CardDescription>
            Lista filtrada automaticamente para {getDocumentTypeLabel(tipo).toLowerCase()}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="size-12 mx-auto mb-2" />
              <p>Nenhum documento cadastrado.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <FileText className="size-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{doc.nome_pdf}</div>
                      <div className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(doc.tipo)} - {String(doc.mes).padStart(2, "0")}/{doc.ano}
                      </div>
                      {doc.colaborador_id && (
                        <div className="text-xs text-muted-foreground">
                          Colaborador: {profiles.find((p) => p.id === doc.colaborador_id)?.nome || "Desconhecido"}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openPreview(doc)}>
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => downloadDoc(doc)}>
                      <Download className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteDoc(doc.id)}>
                      <Trash2 className="size-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingSave} onOpenChange={setPendingSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe documento deste mês</AlertDialogTitle>
            <AlertDialogDescription>
              Encontramos documento(s) do mesmo tipo para este mês e ano. Se continuar, os registros antigos desse período serão substituídos pelos novos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={persistDocuments}>
              Confirmar substituição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pageToIgnore !== null} onOpenChange={(open) => !open && setPageToIgnore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorar esta página?</AlertDialogTitle>
            <AlertDialogDescription>
              A página selecionada será marcada como ignorada e não será salva nem processada neste envio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmIgnorePage}>
              Confirmar ignorar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ColaboradorFormDialog
        open={openPreCadastroDialog}
        onOpenChange={setOpenPreCadastroDialog}
        unidades={unidades}
        cargos={cargos}
        onSuccess={handlePreCadastroSuccess}
        // Construindo o initialData baseado na fonte
        initialData={
          selectedSuggestion
            ? {
                extractedData: selectedSuggestion.extracted_data as ExtractedData,
                suggestionId: selectedSuggestion.id,
              }
            : selectedPageResult
            ? {
                extractedData: selectedPageResult.extractedData as ExtractedData,
                pageNumber: selectedPageResult.pageNumber,
              }
            : null
        }
      />
    </div>
  );
}