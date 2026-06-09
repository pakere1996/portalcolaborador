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
} from "@/lib/documentos";

const routeTypeMap: Record<string, DocumentType> = {
  "/admin/documentos": "contracheque",
  "/admin/documentos/ponto": "folha_ponto",
};

export default function AdminDocumentosPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeType = routeTypeMap[location.pathname] ?? "contracheque";

  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<DocumentType>(routeType);
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [processing, setProcessing] = useState(false);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [manualProfileByPage, setManualProfileByPage] = useState<Record<number, string>>({});
  const [identifiedNames, setIdentifiedNames] = useState<Record<number, string>>({});
  const [stats, setStats] = useState<UploadStats>({ auto: 0, manual: 0, pending: 0, total: 0 });
  const [showResults, setShowResults] = useState(false);
  const [duplicateDocs, setDuplicateDocs] = useState<Documento[]>([]);
  const [pendingSave, setPendingSave] = useState(false);
  const [detectedReference, setDetectedReference] = useState<string>("");

  useEffect(() => {
    setTipo(routeType);
  }, [routeType]);

  useEffect(() => {
    loadData();
  }, [tipo]);

  const loadData = async () => {
    try {
      const [profilesRes, docsRes] = await Promise.all([
        supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("documentos").select("*").eq("tipo", tipo).order("created_at", { ascending: false }),
      ]);

      setProfiles((profilesRes.data ?? []) as Profile[]);
      const docsList = (docsRes.data ?? []) as Documento[];
      setDocs(docsList);
      updateStats(docsList);
      await syncAdminMonthlyDocumentReminder();
    } catch {
      toast.error("Erro ao carregar dados");
    }
  };

  const updateStats = (docsList: Documento[]) => {
    const nextStats: UploadStats = {
      auto: 0,
      manual: 0,
      pending: 0,
      total: docsList.length,
    };

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || selectedFile.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF válido");
      return;
    }

    setFile(selectedFile);
    setShowResults(false);
    setDuplicateDocs([]);
    setDetectedReference("");

    try {
      const pages = await extractPdfText(selectedFile);
      const combinedText = pages.map((page) => page.text).join(" ");
      const detected = detectReferencePeriod(combinedText);

      if (detected) {
        setMes(String(detected.mes));
        setAno(String(detected.ano));
        setDetectedReference(detected.sourceText);
        toast.success("Mês e ano preenchidos automaticamente");
      }
    } catch {
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

        if (match) {
          results.push({
            pageNumber: page.pageNumber,
            text: page.text,
            status: "auto",
            profileId: match.profile.id,
            profileName: match.profile.nome,
            score: match.score,
            identifiedName: match.profile.nome,
          });
        } else {
          const guessedName = guessNameFromText(page.text);
          results.push({
            pageNumber: page.pageNumber,
            text: page.text,
            status: "pending",
            identifiedName: guessedName,
          });
        }
      }

      setPageResults(results);
      setShowResults(true);

      if (duplicates.length > 0) {
        toast.warning("Já existem documentos deste tipo para este mês/ano");
      }
    } catch {
      toast.error("Erro ao processar PDF");
    } finally {
      setProcessing(false);
    }
  }, [file, tipo, mes, ano, profiles]);

  const handleManualAssign = (pageNumber: number, profileId: string) => {
    setManualProfileByPage((prev) => ({
      ...prev,
      [pageNumber]: profileId,
    }));

    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
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
  };

  const persistDocuments = async () => {
    if (!file || !tipo || !mes || !ano) return;

    setProcessing(true);
    const newStats: UploadStats = { auto: 0, manual: 0, pending: 0, total: 0 };

    try {
      const groups: Record<string, PageResult[]> = {};

      for (const page of pageResults) {
        let key: string;

        if (page.status === "auto" || (page.status === "manual" && manualProfileByPage[page.pageNumber])) {
          const profileId = page.status === "auto" ? page.profileId : manualProfileByPage[page.pageNumber];
          key = `profile:${profileId}`;
        } else {
          key = `pending:${page.pageNumber}`;
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(page);
      }

      if (duplicateDocs.length > 0) {
        await supabase
          .from("documentos")
          .delete()
          .eq("tipo", tipo)
          .eq("mes", Number(mes))
          .eq("ano", Number(ano));
      }

      for (const [key, group] of Object.entries(groups)) {
        const isProfileGroup = key.startsWith("profile:");
        const profileId = isProfileGroup ? key.split(":")[1] : null;
        const pageNumbers = group.map((p) => p.pageNumber);
        const mergedPdf = await createMergedPdf(file, pageNumbers);

        const storagePath = isProfileGroup
          ? getDocumentStoragePath(profileId!, tipo, Number(ano), Number(mes))
          : getPendingDocumentStoragePath(tipo, Number(ano), Number(mes), pageNumbers, group[0].identifiedName);

        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(storagePath, mergedPdf, {
            contentType: "application/pdf",
            upsert: true,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        const payload = {
          colaborador_id: isProfileGroup ? profileId : null,
          tipo,
          mes: Number(mes),
          ano: Number(ano),
          storage_path: storagePath,
          status: isProfileGroup ? "vinculado" : "pendente",
          nome_pdf: group[0].identifiedName,
        };

        const { error: dbError } = await supabase.from("documentos").insert(payload);
        if (dbError) throw dbError;

        if (isProfileGroup) {
          if (group[0].status === "manual") {
            newStats.manual += 1;
          } else {
            newStats.auto += 1;
          }
        } else {
          newStats.pending += 1;
        }
        newStats.total += 1;
      }

      setStats(newStats);
      setShowResults(false);
      setFile(null);
      setPendingSave(false);
      setDuplicateDocs([]);
      setDetectedReference("");
      toast.success("Documentos salvos com sucesso");
      await loadData();
    } catch {
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

  const deleteDoc = async (docId: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      const { data: docData } = await supabase.from("documentos").select("storage_path").eq("id", docId).single();
      if (docData?.storage_path) {
        await supabase.storage.from("documentos").remove([docData.storage_path]);
      }

      await supabase.from("documentos").delete().eq("id", docId);
      toast.success("Documento excluído");
      await loadData();
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
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

              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={mes} onValueChange={setMes}>
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
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  placeholder="2026"
                  min="2020"
                  max="2035"
                />
              </div>
            </div>

            {duplicateDocs.length > 0 && (
              <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                Já existem {duplicateDocs.length} documento(s) deste tipo para {String(mes).padStart(2, "0")}/{ano}. Você poderá confirmar a substituição antes de salvar.
              </div>
            )}

            <Button onClick={processPdf} disabled={!file || !mes || !ano || processing} className="w-full">
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
              const isAuto = page.status === "auto";
              const isManual = page.status === "manual";
              const isPending = page.status === "pending";

              return (
                <div key={page.pageNumber} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold">Página {page.pageNumber}</h3>
                    <div className="flex items-center gap-2">
                      {isAuto && <Badge className="bg-green-100 text-green-700 border-green-200">Auto: {page.profileName}</Badge>}
                      {isManual && <Badge className="bg-blue-100 text-blue-700 border-blue-200">Manual: {identifiedNames[page.pageNumber]}</Badge>}
                      {isPending && <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pendente</Badge>}
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                    <p className="font-medium mb-1">Texto extraído:</p>
                    <p className="italic">{page.text.slice(0, 220)}...</p>
                  </div>

                  {(isPending || isManual) && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Vincular manualmente a</Label>
                        <Select
                          value={manualProfileByPage[page.pageNumber] || ""}
                          onValueChange={(value) => handleManualAssign(page.pageNumber, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um colaborador" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles.map((profile) => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Nome identificado no PDF</Label>
                        <Input
                          value={identifiedNames[page.pageNumber] || page.identifiedName || ""}
                          onChange={(e) => handleNameChange(page.pageNumber, e.target.value)}
                          placeholder="Nome do colaborador"
                        />
                      </div>
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
                  "Salvar documentos"
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
    </div>
  );
}