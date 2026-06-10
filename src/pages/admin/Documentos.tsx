// ... existing code ...
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
// ... existing code ...