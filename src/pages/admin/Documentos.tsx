import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
  Trash2
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
  DocumentType
} from "@/lib/documentos";

export default function AdminDocumentosPage() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<DocumentType>("contracheque");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [manualProfileByPage, setManualProfileByPage] = useState<Record<number, string>>({});
  const [identifiedNames, setIdentifiedNames] = useState<Record<number, string>>({});
  const [stats, setStats] = useState<UploadStats>({ auto: 0, manual: 0, pending: 0, total: 0 });
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profilesRes, docsRes] = await Promise.all([
        supabase.from("profiles").select("id, nome").eq("ativo", true),
        supabase.from("documentos").select("*").order("created_at", { ascending: false })
      ]);

      setProfiles(profilesRes.data || []);
      setDocs(docsRes.data || []);
      updateStats(docsRes.data || []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    }
  };

  const updateStats = (docsList: Documento[]) => {
    const stats = {
      auto: 0,
      manual: 0,
      pending: 0,
      total: docsList.length
    };

    docsList.forEach(doc => {
      if (doc.status === "pendente") {
        stats.pending++;
      } else {
        stats.vinculado++;
      }
    });

    setStats(stats);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setShowResults(false);
    } else {
      toast.error("Selecione um arquivo PDF válido");
    }
  };

  const processPdf = useCallback(async () => {
    if (!file || !tipo || !mes || !ano) {
      toast.error("Preencha todos os campos");
      return;
    }

    setProcessing(true);
    try {
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
            identifiedName: match.profile.nome
          });
        } else {
          const guessedName = guessNameFromText(page.text);
          results.push({
            pageNumber: page.pageNumber,
            text: page.text,
            status: "pending",
            identifiedName: guessedName
          });
        }
      }

      setPageResults(results);
      setShowResults(true);
    } catch (error) {
      toast.error("Erro ao processar PDF");
    } finally {
      setProcessing(false);
    }
  }, [file, tipo, mes, ano, profiles]);

  const handleManualAssign = (pageNumber: number, profileId: string) => {
    setManualProfileByPage(prev => ({
      ...prev,
      [pageNumber]: profileId
    }));
    
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setIdentifiedNames(prev => ({
        ...prev,
        [pageNumber]: profile.nome
      }));
    }
  };

  const handleNameChange = (pageNumber: number, name: string) => {
    setIdentifiedNames(prev => ({
      ...prev,
      [pageNumber]: name
    }));
  };

  const saveDecisions = async () => {
    if (!file || !tipo || !mes || !ano) return;

    setProcessing(true);
    const newStats: UploadStats = { auto: 0, manual: 0, pending: 0, total: 0 };

    try {
      // Agrupar páginas por destino
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

      // Processar cada grupo
      for (const [key, group] of Object.entries(groups)) {
        const isProfileGroup = key.startsWith("profile:");
        const profileId = isProfileGroup ? key.split(":")[1] : null;
        const isPending = !isProfileGroup;

        // Criar PDF mesclado
        const pageNumbers = group.map(p => p.pageNumber);
        const mergedPdf = await createMergedPdf(file, pageNumbers);

        // Definir caminho de armazenamento
        const storagePath = isProfileGroup
          ? getDocumentStoragePath(profileId!, tipo, parseInt(ano), parseInt(mes))
          : getPendingDocumentStoragePath(tipo, parseInt(ano), parseInt(mes), pageNumbers, group[0].identifiedName);

        // Fazer upload
        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(storagePath, mergedPdf, {
            contentType: "application/pdf",
            upsert: true,
            cacheControl: "3600"
          });

        if (uploadError) throw uploadError;

        // Inserir no banco
        const payload: any = {
          colaborador_id: isProfileGroup ? profileId : null,
          tipo,
          mes: parseInt(mes),
          ano: parseInt(ano),
          storage_path: storagePath,
          status: isProfileGroup ? "vinculado" : "pendente",
          nome_pdf: group[0].identifiedName
        };

        const { error: dbError } = await supabase.from("documentos").insert(payload);
        if (dbError) throw dbError;

        // Atualizar estatísticas
        if (isProfileGroup) {
          if (group[0].status === "auto") {
            newStats.auto++;
          } else {
            newStats.manual++;
          }
        } else {
          newStats.pending++;
        }
        newStats.total++;
      }

      setStats(newStats);
      toast.success("Documentos salvos com sucesso!");
      setShowResults(false);
      setFile(null);
      loadData();
    } catch (error) {
      toast.error("Erro ao salvar documentos");
    } finally {
      setProcessing(false);
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Tem certeza que deseja excluir este documento?")) return;

    try {
      // Deletar do storage
      const { data: docData } = await supabase.from("documentos").select("storage_path").eq("id", docId).single();
      if (docData) {
        await supabase.storage.from("documentos").remove([docData.storage_path]);
      }

      // Deletar do banco
      await supabase.from("documentos").delete().eq("id", docId);
      
      toast.success("Documento excluído");
      loadData();
    } catch (error) {
      toast.error("Erro ao excluir documento");
    }
  };

  const openPreview = async (doc: Documento) => {
    try {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(doc.storage_path, 300);
      
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Erro ao carregar documento");
    }
  };

  const downloadDoc = async (doc: Documento) => {
    try {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(doc.storage_path, 300);
      
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = doc.nome_pdf;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error("Erro ao baixar documento");
    }
  };

  const getTypeLabel = (type: DocumentType) => {
    return type === "contracheque" ? "Contracheque" : "Folha de Ponto";
  };

  const getStatusBadge = (status: string) => {
    if (status === "vinculado") {
      return <Badge className="bg-green-100 text-green-700 border-green-200">Vinculado</Badge>;
    }
    return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Pendente</Badge>;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Gestão de Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload, processamento e gerenciamento de documentos da equipe.
        </p>
      </div>

      {/* Painel de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="size-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.auto}</div>
            <div className="text-sm text-muted-foreground">Vinculados (Auto)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="size-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold">{stats.manual}</div>
            <div className="text-sm text-muted-foreground">Vinculados (Manual)</div>
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

      {/* Upload e processamento */}
      <Card>
        <CardHeader>
          <CardTitle>Upload de Documentos</CardTitle>
          <CardDescription>
            Selecione um PDF, tipo de documento e mês/ano de referência.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Arquivo PDF</Label>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={processing}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={tipo} onValueChange={(value: DocumentType) => setTipo(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contracheque">Contracheque</SelectItem>
                  <SelectItem value="folha_ponto">Folha de Ponto</SelectItem>
                </SelectContent>
              </Select>
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
                placeholder="2024"
                min="2020"
                max="2030"
              />
            </div>
          </div>
          
          <Button
            onClick={processPdf}
            disabled={!file || !tipo || !mes || !ano || processing}
            className="w-full"
          >
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

      {/* Resultados do processamento */}
      {showResults && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados do Processamento</CardTitle>
            <CardDescription>
              Revise e decida como vincular cada página do documento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {pageResults.map((page) => {
              const isAuto = page.status === "auto";
              const isManual = page.status === "manual";
              const isPending = page.status === "pending";
              
              return (
                <div key={page.pageNumber} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Página {page.pageNumber}</h3>
                    <div className="flex items-center gap-2">
                      {isAuto && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          Auto: {page.profileName}
                        </Badge>
                      )}
                      {isManual && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                          Manual: {identifiedNames[page.pageNumber]}
                        </Badge>
                      )}
                      {isPending && (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                          Pendente
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                    <p className="font-medium mb-1">Texto extraído:</p>
                    <p className="italic">{page.text.slice(0, 200)}...</p>
                  </div>
                  
                  {isPending && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Vincular manualmente a:</Label>
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
                        <Label>Nome identificado no PDF:</Label>
                        <Input
                          value={identifiedNames[page.pageNumber] || ""}
                          onChange={(e) => handleNameChange(page.pageNumber, e.target.value)}
                          placeholder="Nome do colaborador"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setShowResults(false)}>
                Cancelar
              </Button>
              <Button onClick={saveDecisions} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" /> Salvando...
                  </>
                ) : (
                  "Salvar Decisões"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de documentos existentes */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Cadastrados</CardTitle>
          <CardDescription>
            Todos os documentos processados e vinculados.
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
                <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <FileText className="size-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{doc.nome_pdf}</div>
                      <div className="text-sm text-muted-foreground">
                        {getTypeLabel(doc.tipo)} - {formatBR(new Date(doc.ano, doc.mes - 1, 1))}
                      </div>
                      {doc.colaborador_id && (
                        <div className="text-xs text-muted-foreground">
                          Colaborador: {profiles.find(p => p.id === doc.colaborador_id)?.nome || "Desconhecido"}
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
    </div>
  );
}