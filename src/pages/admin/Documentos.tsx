import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Tables } from "@/integrations/supabase/types";
import { processPdf, DocumentPage, DocumentType } from "@/lib/documentos";
import { maskCNPJ } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "contracheque", label: "Contracheque" },
  { value: "folha_ponto", label: "Folha de Ponto" },
];

const fetchUnidades = async (): Promise<any[]> => {
  const { data, error } = await supabase.from("unidades").select("*").eq("ativo", true);
  if (error) throw error;
  return data;
};

export default function AdminDocumentosPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [unidades] = useQuery(["unidades"], fetchUnidades);
  const [processedPages, setProcessedPages] = useState<DocumentPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showColaboradorForm, setShowColaboradorForm] = useState(false);
  const [selectedProfileForManualLink, setSelectedProfileForManualLink] = useState<any>(null);
  const [isUnitLocked, setIsUnitLocked] = useState(false);

  // Mutation that runs processPdf and stores the result
  const processPdfMutation = useMutation({
    mutationFn: async ({ file, documentType, unidadeId }: { file: File; documentType: DocumentType; unidadeId: string }) => {
      setIsProcessing(true);
      const pages = await processPdf(file, documentType, unidadeId);
      setProcessedPages(pages);
      setCurrentPageIndex(0);
      setIsProcessing(false);
      // Auto‑lock the unidade field after first successful processing
      if (pages.length > 0) {
        setSelectedUnidadeId(pages[0].extractedData.extracted_unidade_id);
        setIsUnitLocked(true);
      }
      return pages;
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error("Erro ao processar PDF.", { description: error.message });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setProcessedPages([]);
      setCurrentPageIndex(0);
      setIsUnitLocked(false);
    }
  };

  const handleProcess = () => {
    if (file && documentType && selectedUnidadeId) {
      processPdfMutation.mutate({ file, documentType: documentType as DocumentType, unidadeId: selectedUnidadeId });
    } else {
      toast.warning("Selecione o arquivo, o tipo de documento e a unidade.");
    }
  };

  const handleSavePage = useCallback(async (profileId: string) => {
    if (!file || !currentPageIndex) return;
    setIsSaving(true);
    try {
      const storagePath = `documentos/${selectedUnidadeId}/${documentType}/${profileId}/${file.name}_page_${currentPageIndex}`;
      await supabase.storage.from("documentos").upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });
      toast.success(`Página ${currentPageIndex + 1} vinculada com sucesso.`);
      setProcessedPages(prev => {
        const newPages = [...prev];
        if (newPages[currentPageIndex]) {
          newPages[currentPageIndex] = { ...newPages[currentPageIndex], matchStatus: "matched" };
        }
        return newPages;
      });
      setCurrentPageIndex(prev => prev + 1);
    } catch (error) {
      console.error("Erro ao salvar documento:", error);
      toast.error("Falha ao salvar documento.", { description: error instanceof Error ? error.message : "Erro desconhecido." });
    } finally {
      setIsSaving(false);
    }
  }, [file, currentPageIndex, selectedUnidadeId, documentType]);

  const handleIgnorePage = () => {
    if (!currentPageIndex) return;
    setProcessedPages(prev => {
      const newPages = [...prev];
      if (newPages[currentPageIndex]) {
        newPages[currentPageIndex] = { ...newPages[currentPageIndex], matchStatus: "unmatched" };
      }
      return newPages;
    });
    toast.info(`Página ${currentPageIndex + 1} ignorada.`);
    setCurrentPageIndex(prev => prev + 1);
  };

  const handleManualLink = (profile: any) => {
    setSelectedProfileForManualLink(profile);
  };

  const handleConfirmManualLink = () => {
    if (selectedProfileForManualLink) {
      handleSavePage(selectedProfileForManualLink.id);
      setSelectedProfileForManualLink(null);
    }
  };

  const handleCreateNewColaborador = () => {
    setShowColaboradorForm(true);
  };

  const currentUnit = unidades?.find(u => u.id === selectedUnidadeId);
  const extractedUnit = processedPages?.[currentPageIndex]?.extractedData?.extracted_unidade_id
    ?.toString()
    ?.match(/\d+/)?.[0];

  const renderProcessingStep = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-pakere-red" />
          <p className="mt-4 text-lg">Processando PDF, aguarde...</p>
        </div>
      );
    }

    if (currentPageIndex >= processedPages.length && processedPages.length > 0) {
      const linkedCount = processedPages.filter(p => p.matchStatus === "matched").length;
      const duplicateCount = processedPages.filter(p => p.matchStatus === "duplicate").length;
      const unmatchedCount = processedPages.filter(p => p.matchStatus === "unmatched").length;

      return (
        <div className="p-6 text-center">
          <Loader2 className="h-12 w-12 animate-spin text-green-500 mr-2" />
          <h3 className="text-xl font-semibold">Processamento Concluído!</h3>
          <p className="text-muted-foreground mt-2">
            {linkedCount} documentos vinculados, {duplicateCount} duplicatas detectadas, {unmatchedCount} páginas ignoradas/pendentes.
          </p>
          <Button onClick={() => { setFile(null); setProcessedPages([]); }}>
            Processar Novo Documento
          </Button>
        </div>
      );
    }

    if (!currentPageIndex) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          {processedPages.length > 0 ? "Clique em 'Processar PDF' para iniciar." : "Aguardando arquivo para processamento."}
        </div>
      );
    }

    const { extractedData, matchStatus } = processedPages[currentPageIndex];
    const matchedProfile = processedPages.length > 0 && processedPages[currentPageIndex].extractedData
      ? processedPages[currentPageIndex].extractedData.nome
      : "";
    const isMatched = matchStatus === "matched";
    const isDuplicate = matchStatus === "duplicate";
    const isUnmatched = matchStatus === "unmatched";

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-lg font-semibold">
            Página {currentPageIndex + 1} de {processedPages.length}
          </h4>
          <DocumentPreview pageText={processedPages[currentPageIndex].text} />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card className="border-pakere-yellow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <CardDescription>
                  Informações lidas automaticamente do PDF.
                </CardDescription>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Nome:</strong> {extractedData.nome}</p>
              <p><strong>CPF:</strong> {extractedData.cpf}</p>
              <p><strong>Matrícula:</strong> {extractedData.matricula || "N/A"}</p>
              <p><strong>Mês/Ano:</strong> {extractedData.mes}/{extractedData.ano || "N/A"}</p>
                            <div className="pt-2 border-t mt-2">
                <p className="font-semibold flex items-center gap-1">
                  <Building2 className="size-4" /> Unidade (Extraída)
                </p>
                {extractedUnit ? (
                  <div className="text-green-600">
                    {extractedUnit.nome} - {maskCNPJ(extractedUnit.cnpj)}
                  </div>
                ) : (
                  <div className="text-red-600">
                    Não detectada automaticamente.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isDuplicate && (
            <div className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Duplicata Detectada: Documento já existe para este colaborador, mês, ano e unidade.</span>
            </div>
          )}

          {isMatched && (
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <CardDescription>
                    Colaborador Encontrado
                  </CardDescription>
                </CardTitle>
                <CardContent className="space-y-2 text-sm">
                  <p><strong>Nome:</strong> {matchedProfile}</p>
                  <p><strong>CPF:</strong> {processedPages[currentPageIndex].extractedData.cpf}</p>
                  <p><strong>Ação:</strong> Vincular automaticamente.</p>
                </CardContent>
                <div className="p-4 pt-0">
                  <Button                    onClick={() => handleSavePage(selectedProfileForManualLink?.id)}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Link className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Vínculo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isUnmatched && !isDuplicate && (
            <Card className="border-pakere-red">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pakere-red">
                  <XCircle className="h-5 w-5" />
                  <CardDescription>
                    Colaborador Não Encontrado
                  </CardDescription>
                </CardTitle>
                <CardContent className="space-y-3">
                  <Select
                    onValueChange={(profileId: string) => {
                      const profile = processedPages[currentPageIndex].extractedData;
                      const candidate = unidades.find(u => u.id === profileId);
                      if (candidate) handleManualLink(candidate);
                    }}
                    value={selectedProfileForManualLink?.id || ""}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vincular Manualmente a..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades
                        .filter(u => u.id === extractedData.extracted_unidade_id)
                        .map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome} ({u.cnpj})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedProfileForManualLink && (
                    <Button
                      onClick={handleConfirmManualLink}
                      className="w-full"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Link className="h-4 w-4 mr-2" />
                      )}
                      Confirmar Vínculo Manual
                    </Button>
                  )}
                  <Button onClick={handleIgnorePage} variant="secondary" className="w-full">
                    Ignorar Página
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Importação de Documentos</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configuração da Importação</CardTitle>
          <CardDescription>
            Selecione o arquivo, o tipo de documento e a unidade para iniciar o processamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input type="file" accept="application/pdf" onChange={handleFileChange} />
            <Select
              onValueChange={(value) => setDocumentType(value as DocumentType)}
              value={documentType}
              disabled={isProcessing || processedPages.length > 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Documento" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Select
                onValueChange={(value) => setSelectedUnidadeId(value)}
                value={selectedUnidadeId}
                disabled={isProcessing || isUnitLocked || processedPages.length > 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a Unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades?.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.nome} - {maskCNPJ(unidade.cnpj)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isUnitLocked && (
                <Button
                  variant="outline"
                  onClick={() => setIsUnitLocked(false)}
                  title="Corrigir Unidade"
                >
                  Corrigir
                </Button>
              )}
            </div>
          </div>
          <Button
            onClick={handleProcess}
            disabled={!file || !documentType || !selectedUnidadeId || isProcessing}
            className="w-full bg-pakere-yellow hover:bg-pakere-yellow/90 text-black"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            {isProcessing ? "Processando..." : "Processar PDF"}
          </Button>
        </CardContent>
      </Card>

      {processedPages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisão e Vinculação</CardTitle>
            <CardDescription>
              Revise os dados extraídos e vincule cada página a um colaborador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderProcessingStep()}
          </CardContent>
        </Card>
      )}

      {showColaboradorForm && (
        <ColaboradorFormDialog
          open={showColaboradorForm}
          onOpenChange={(open) => {
            if (!open) handleColaboradorFormClose(false);
          }}
          profile={{
            id: "",
            nome: processedPages[currentPageIndex]?.extractedData.nome || "",
            cpf: processedPages[currentPageIndex]?.extractedData.cpf || "",
            cargo: "",
            matricula: processedPages[currentPageIndex]?.extractedData.matricula || "",
            ativo: true,
            unidade_id: selectedUnidadeId,
          } as any}
        />
      )}
    </div>
  );
}