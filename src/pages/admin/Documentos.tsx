// ... existing code ...
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
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <p>Nome: <span className="font-semibold text-foreground">{page.extractedData?.nome || 'N/A'}</span></p>
                      <p>CPF: <span className="font-semibold text-foreground">{page.extractedData?.cpf || 'N/A'}</span></p>
                      <p>Cargo: <span className="font-semibold text-foreground">{page.extractedData?.cargo || 'N/A'}</span></p>
                      <p>Matrícula: <span className="font-semibold text-foreground">{page.extractedData?.matricula || 'N/A'}</span></p>
                    </div>
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
              <Button
                onClick={handleSave}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <Spinner className="size-4 mr-2" />
                ) : (
                  <Check className="size-4 mr-2" />
                )}
                {isProcessing ? 'Salvando...' : 'Salvar Vínculos'}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="size-4 mr-2" />
                Resetar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};