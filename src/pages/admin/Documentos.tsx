export default function AdminDocumentosPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>("");
  const [processedPages, setProcessedPages] = useState<DocumentPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showColaboradorForm, setShowColaboradorForm] = useState(false);
  const [selectedProfileForManualLink, setSelectedProfileForManualLink] = useState<Profile | null>(null);
  const [isUnitLocked, setIsUnitLocked] = useState(false);

  const { data: unidades, isLoading: isLoadingUnidades } = useQuery({
    queryKey: ["unidades"],
    queryFn: fetchUnidades,
  });

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
  });

  const currentDocumentPage = useMemo(() => processedPages[currentPageIndex], [
    processedPages,
    currentPageIndex,
  ]);

  const isReadyToProcess = file && documentType && selectedUnidadeId;
  const isProcessingComplete = currentPageIndex >= processedPages.length && processedPages.length > 0;

  const processPdfMutation = useMutation({
    mutationFn: async ({ file, documentType, unidadeId }: { file: File, documentType: DocumentType, unidadeId: string }) => {
      setIsProcessing(true);
      return processPdf(file, documentType, unidadeId);
    },
    onSuccess: (pages) => {
      setProcessedPages(pages);
      setCurrentPageIndex(0);
      setIsProcessing(false);
      toast.success(`PDF processado. ${pages.length} páginas encontradas.`);
      console.log("[DEBUG] Raw Processed Pages:", pages);
            const firstPage = pages[0];
      if (firstPage?.extractedData.extracted_unidade_id) {
        setSelectedUnidadeId(firstPage.extractedData.extracted_unidade_id);
        setIsUnitLocked(true);
      } else {
        setIsUnitLocked(false);
      }
    },
    onError: (error) => {
      setIsProcessing(false);
      console.error("Erro ao processar PDF:", error);
      toast.error("Erro ao processar PDF.", {
        description: error.message,
      });
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
    if (!file || !currentDocumentPage) return;

    setIsSaving(true);
    try {
      const storagePath = `documents/${currentDocumentPage.extractedData.unidade_id}/${documentType}/${profileId}/${file.name}_page_${currentPageIndex}`;
            await saveDocument(currentDocumentPage, file, profileId, storagePath);
      
      setProcessedPages(prev => 
        prev.map((page, index) => 
          index === currentPageIndex ? { ...page, matchStatus: "matched" } : page
      );
      
      toast.success(`Página ${currentPageIndex + 1} vinculada com sucesso.`);
      setCurrentPageIndex(prev => prev + 1);
    } catch (error) {
      console.error("Erro ao salvar documento:", error);
      toast.error("Falha ao salvar documento.", {
        description: error instanceof Error ? error.message : "Erro desconhecido.",
      });
    } finally {
      setIsSaving(false);
    }
  }, [file, currentDocumentPage, currentPageIndex, documentType]);

  const handleIgnorePage = () => {
    if (!currentDocumentPage) return;
    
    setProcessedPages(prev =>       prev.map((page, index) => 
        index === currentPageIndex ? { ...page, matchStatus: "unmatched" } : page
      )
    );
    
    toast.info(`Página ${currentPageIndex + 1} ignorada.`);
    setCurrentPageIndex(prev => prev + 1);
  };

  const handleManualLink = (profile: Profile) => {
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

  const handleColaboradorFormClose = (success: boolean) => {
    setShowColaboradorForm(false);
    if (success) {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setCurrentPageIndex(prev => prev + 1);
    }
  };

  const currentUnit = unidades?.find(u => u.id === currentDocumentPage?.extractedData.unidade_id);
  const extractedUnit = unidades?.find(u => u.id === currentDocumentPage?.extractedData.extracted_unidade_id);

  const renderProcessingStep = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-pakere-red" />
          <p className="mt-4 text-lg">Processando PDF, aguarde...</p>
        </div>
      );
    }

    if (isProcessingComplete) {
      const linkedCount = processedPages.filter(p => p.matchStatus === "matched").length;
      const duplicateCount = processedPages.filter(p => p.matchStatus === "duplicate").length;
      const unmatchedCount = processedPages.filter(p => p.matchStatus === "unmatched").length;

      return (
        <div className="p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-semibold">Processamento Concluído!</h3>
          <p className="text-muted-foreground mt-2">
            {linkedCount} documentos vinculados, {duplicateCount} duplicatas detectadas, {unmatchedCount} páginas ignoradas/pendentes.
          </p>
          <Button onClick={() => { setFile(null); setProcessedPages([]); }} className="mt-6">
            Processar Novo Documento
          </Button>
        </div>
      );
    }

    if (!currentDocumentPage) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          {processedPages.length > 0 ? "Clique em 'Processar PDF' para iniciar." : "Aguardando arquivo para processamento."}
        </div>
      );
    }

    const { extractedData, matchStatus } = currentDocumentPage;
    const matchedProfile = profiles?.find(p => p.cpf === extractedData.cpf || p.matricula === extractedData.matricula);
    const isMatched = matchStatus === "matched" && matchedProfile;
    const isDuplicate = matchStatus === "duplicate";
    const isUnmatched = matchStatus === "unmatched";

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-lg font-semibold">
            Página {currentPageIndex + 1} de {processedPages.length}
          </h4>
          <DocumentPreview pageText={currentDocumentPage.text} />
        </div>

        <div className="lg:col-span-1 space-y-4">
          <Card className="border-pakere-yellow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Dados Extraídos
              </CardTitle>
              <CardDescription>
                Informações lidas automaticamente do PDF.
              </CardDescription>
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
                  <CheckCircle className="h-5 w-5" /> Colaborador Encontrado
                </CardTitle>
                <CardDescription>
                  O sistema encontrou um colaborador correspondente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Nome:</strong> {matchedProfile?.nome}</p>
                <p><strong>CPF:</strong> {matchedProfile?.cpf}</p>
                <p><strong>Ação:</strong> Vincular automaticamente.</p>
              </CardContent>
              <div className="p-4 pt-0">
                <Button 
                  onClick={() => handleSavePage(matchedProfile?.id)} 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
                  Confirmar Vínculo
                </Button>
              </div>
            </Card>
          )}

          {isUnmatched && !isDuplicate && (
            <Card className="border-pakere-red">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pakere-red">
                  <XCircle className="h-5 w-5" /> Colaborador Não Encontrado
                </CardTitle>
                <CardDescription>
                  Nenhum perfil ativo correspondente foi encontrado na unidade selecionada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  onValueChange={(profileId) => {
                    const profile = profiles?.find(p => p.id === profileId) || null;
                    handleManualLink(profile);
                  }}
                  value={selectedProfileForManualLink?.id || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular Manualmente a..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.filter(p => p.unidade_id === currentDocumentPage.extractedData.unidade_id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} ({p.cpf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfileForManualLink && (
                  <Button 
                    onClick={handleConfirmManualLink}                     className="w-full"
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
                    Confirmar Vínculo Manual
                  </Button>
                )}

                <Button 
                  onClick={handleCreateNewColaborador}                   variant="outline" 
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar Novo Colaborador
                </Button>

                <Button 
                  onClick={handleIgnorePage} 
                  variant="secondary" 
                  className="w-full"
                >
                  Ignorar Página
                </Button>
              </CardContent>
            </Card>
          )}
          
          {isDuplicate && (
            <Button 
              onClick={handleIgnorePage} 
              variant="secondary" 
              className="w-full"
            >
              Avançar (Ignorar Duplicata)
            </Button>
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
                onValueChange={setSelectedUnidadeId}
                value={selectedUnidadeId}
                disabled={isLoadingUnidades || isProcessing || processedPages.length > 0 || isUnitLocked}
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
            disabled={!isReadyToProcess || isProcessing || processedPages.length > 0}
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
            nome: currentDocumentPage?.extractedData.nome || "",
            cpf: currentDocumentPage?.extractedData.cpf || "",
            cargo: "",
            matricula: currentDocumentPage?.extractedData.matricula || "",
            ativo: true,
            aprovacao_status: "aprovado",
            unidade_id: currentDocumentPage?.extractedData.unidade_id || selectedUnidadeId,
          } as Profile}
        />
      )}
    </div>
  );
}