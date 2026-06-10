import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText, Download, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PDFDocument, PDFPage } from "pdf-lib";
import { extractCNPJs, cleanCNPJ, extractMonthAndYear } from "@/lib/documentos";
import { maskCNPJ } from "@/lib/utils";

const DOCUMENT_TYPE_MAP: Record<string, "contracheque" | "folha_ponto"> = {
  "/admin/documentos": "contracheque",
  "/admin/documentos/ponto": "folha_ponto",
};

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  ativo: boolean;
  aprovacao_status?: string;
  data_admissao?: string | null;
  data_demissao?: string | null;
  data_nascimento?: string | null;
  folga_fixa_semana?: number | null;
  endereco: string | null;
  email_contato: string | null;
  whatsapp: string | null;
  unidade_id: string | null;
}

interface ExtractedData {
  nome: string;
  cpf: string;
  matricula: string;
  unidade_id: string | null;
  mes: number | null;
  ano: number | null;
}

interface PageResult {
  index: number;
  extractedData: ExtractedData | null;
  status: "matched" | "unmatched" | "duplicate";
  matchedProfile: Profile | null;
  unidadeIdFromCnpj: string | null;
  onePageBlob: Blob | null;
}

export default function AdminDocumentosPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Determine document type from route
  const documentType = useMemo(() => {
    const path = window.location.pathname;
    return DOCUMENT_TYPE_MAP[path] || "contracheque";
  }, []);

  // Fetch active unidades
  const { data: unidades = [], isLoading: unidadesLoading } = useQuery({
    queryKey: ["unidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const queryClient = useQueryClient();

  // Mutation to process the uploaded file (split into pages and extract data)
  const processFileMutation = useMutation({
    mutationFn: async (uploadedFile: File) => {
      setIsProcessing(true);
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();
      const results: PageResult[] = [];

      for (let i = 0; i < numPages; i++) {
        // Extract a single page PDF
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        const singlePagePdfBytes = await singlePagePdf.save();
        const blob = new Blob([singlePagePdfBytes], { type: "application/pdf" });
        const singlePageFile = new File([blob], `page_${i}.pdf`, { type: "application/pdf" });

        // Extract data from the single page PDF
        const extractedData = await extractDataFromPdfFile(singlePageFile, documentType);

        // Determine unidade_id from CNPJ in the extracted text
        const unidadeIdFromCnpj = await getUnidadeIdFromCnpjInText(
          extractedData?.text || "",
          unidades
        );

        results.push({
          index: i,
          extractedData: extractedData?.data || null,
          status: "pending", // will be updated in the next step
          matchedProfile: null,
          unidadeIdFromCnpj,
          onePageBlob: blob,
        });
      }

      setIsProcessing(false);
      return results;
    },
    onSuccess: (results) => {
      // Now we need to determine the status for each page (matched, unmatched, duplicate)
      const updatedResults = results.map((result) => {
        if (!result.extractedData) {
          return { ...result, status: "unmatched" };
        }

        const { cpf, unidade_id: extractedUnidadeId, mes, ano } = result.extractedData;

        // Check for duplicate: if we have a profile match, check if document already exists
        let matchedProfile: Profile | null = null;
        if (cpf && extractedUnidadeId && mes !== null && ano !== null) {
          matchedProfile = profiles.find(
            (p) =>
              p.cpf === cpf &&
              p.unidade_id === extractedUnidadeId &&
              p.ativo === true
          );
        }

        if (matchedProfile) {
          // Check for duplicate document
          const { count } = await supabase
            .from("documentos")
            .select("id", { count: "exact", head: true })
            .eq("colaborador_id", matchedProfile.id)
            .eq("tipo", documentType)
            .eq("mes", mes)
            .eq("ano", ano);

          if (count > 0) {
            return { ...result, status: "duplicate", matchedProfile };
          }
          return { ...result, status: "matched", matchedProfile };
        }

        // If we have a profile by CPF but different unidade, we still consider unmatched
        // but we can note that there is a profile with this CPF (for UI)
        const profileByCpf = profiles.find(
          (p) => p.cpf === cpf && p.ativo === true
        );

        return {
          ...result,
          status: "unmatched",
          matchedProfile: profileByCpf || null,
        };
      });

      setPageResults(updatedResults);
      setCurrentPageIndex(0);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error("Erro ao processar o arquivo", { description: error.message });
    },
  });

  // Mutation to upload a one-page PDF and create a document record
  const uploadDocumentMutation = useMutation({
    mutationFn: async ({
      perfilId,
      pageBlob,
      fileName,
    }: {
      perfilId: string;
      pageBlob: Blob;
      fileName: string;
    }) => {
      setIsUploading(true);
      const storagePath = `documentos/${documentType}/${perfilId}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, pageBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get the colaborador's unidade_id from their profile
      const perfil = profiles.find((p) => p.id === perfilId);
      const unidadeId = perfil?.unidade_id ?? null;

      // Create document record
      const { error: insertError } = await supabase
        .from("documentos")
        .insert({
          colaborador_id: perfilId,
          tipo: documentType,
          mes: pageResults[currentPageIndex]?.extractedData?.mes,
          ano: pageResults[currentPageIndex]?.extractedData?.ano,
          storage_path: storagePath,
          status: "vinculado",
          nome_pdf: fileName,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Documento vinculado com sucesso!");
      setIsUploading(false);
      // Move to next page
      if (currentPageIndex < pageResults.length - 1) {
        setCurrentPageIndex(currentPageIndex + 1);
      } else {
        // All pages processed
        setPageResults([]);
        setFile(null);
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error("Erro ao vincular documento", { description: error.message });
    },
  });

  // Mutation to create a new colaborador
  const createColaboradorMutation = useMutation({
    mutationFn: async ({
      nome,
      cpf,
      matricula,
      unidade_id,
      data_nascimento,
    }: {
      nome: string;
      cpf: string;
      matricula: string | null;
      unidade_id: string | null;
      data_nascimento: string | null;
    }) => {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          nome,
          cpf: cleanCNPJ(cpf),
          matricula: matricula || null,
          unidade_id,
          data_nascimento: data_nascimento || null,
          ativo: true,
          cargo: "Colaborador", // default cargo
        })
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: (newProfile) => {
      toast.success("Colaborador criado com sucesso!");
      // Refetch profiles
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      // Now we can link the document to this new profile
      // We'll simulate a click on the link button for the current page
      // But we need to update the pageResult to reflect the new profile
      // We'll do it by updating the pageResults state
      setPageResults((prev) => {
        return prev.map((result, index) => {
          if (index === currentPageIndex) {
            return {
              ...result,
              status: "matched",
              matchedProfile: newProfile,
            };
          }
          return result;
        });
      });
      // Then we can trigger the upload
      // We'll do it in a separate step? Actually, we can just call the upload mutation
      // But we are in the onSuccess of the create mutation. We'll set a state to trigger upload?
      // Instead, we'll let the user click the link button again? 
      // We'll just show a message and let the user click the link button.
    },
    onError: (error) => {
      toast.error("Erro ao criar colaborador", { description: error.message });
    },
  });

  // Helper function to extract data from a single page PDF file
  const extractDataFromPdfFile = async (
    file: File,
    docType: "contracheque" | "folha_ponto"
  ): Promise<{ data: ExtractedData | null; text: string } | null> => {
    try {
      // We'll reuse the logic from src/lib/documentos.ts but for a single file
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();
      if (numPages === 0) return null;

      const page = pdfDoc.getPage(0);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map((item: any) => item.str)
        .join(" ");

      // Extract CNPJs
      const cnpjMatches = extractCNPJs(text);
      let unidade_id: string | null = null;
      if (cnpjMatches.length > 0) {
        // Find the first CNPJ that matches an active unidade
        for (const cnpj of cnpjMatches) {
          const cleaned = cleanCNPJ(cnpj);
          const unidade = unidades.find(
            (u) => u.cnpj && cleanCNPJ(u.cnpj) === cleaned
          );
          if (unidade) {
            unidade_id = unidade.id;
            break;
          }
        }
      }

      // Extract month and year
      const dateInfo = extractMonthAndYear(text, docType);
      const mes = dateInfo?.mes ?? null;
      const ano = dateInfo?.ano ?? null;

      // Extract other fields (name, CPF, matricula) - simplified
      const nomeMatch = text.match(/Nome:\s*([^\n]+)/i);
      const nome = nomeMatch ? nomeMatch[1].trim() : "";
      const cpfMatch = text.match(/CPF:\s*([^\n]+)/i);
      const cpf = cpfMatch ? cleanCNPJ(cpfMatch[1]) : "";
      const matriculaMatch = text.match(/Matrícula:\s*([^\n]+)/i);
      const matricula = matriculaMatch ? matriculaMatch[1].trim() : null;

      const extractedData: ExtractedData = {
        nome,
        cpf,
        matricula: matricula || "",
        unidade_id,
        mes,
        ano,
      };

      return { data: extractedData, text };
    } catch (error) {
      console.error("Erro ao extrair dados do PDF:", error);
      return null;
    }
  };

  // Helper function to get unidade ID from CNPJ in text
  const getUnidadeIdFromCnpjInText = async (
    text: string,
    unidadesList: Unidade[]
  ): Promise<string | null> => {
    const cnpjMatches = extractCNPJs(text);
    for (const cnpj of cnpjMatches) {
      const cleaned = cleanCNPJ(cnpj);
      const unidade = unidadesList.find(
        (u) => u.cnpj && cleanCNPJ(u.cnpj) === cleaned
      );
      if (unidade) return unidade.id;
    }
    return null;
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPageResults([]);
      setCurrentPageIndex(0);
    }
  };

  // Handle processing the file
  const handleProcessFile = () => {
    if (!file) return;
    processFileMutation.mutate(file);
  };

  // Handle linking the document (upload and create record)
  const handleLinkDocument = () => {
    const currentResult = pageResults[currentPageIndex];
    if (
      !currentResult ||
      currentResult.status !== "matched" ||
      !currentResult.matchedProfile ||
      !currentResult.onePageBlob
    )
      return;

    const fileName = `documento_${currentResult.index}_${Date.now()}.pdf`;
    uploadDocumentMutation.mutate({
      perfilId: currentResult.matchedProfile.id,
      pageBlob: currentResult.onePageBlob,
      fileName,
    });
  };

  // Handle creating a new colaborador
  const handleCreateColaborador = () => {
    const currentResult = pageResults[currentPageIndex];
    if (!currentResult) return;

    const { nome, cpf, matricula } = currentResult.extractedData || {};
    // We don't have data_nascimento from the PDF, so we leave it null
    createColaboradorMutation.mutate({
      nome: nome || "Nome não encontrado",
      cpf: cpf || "000.000.000-00",
      matricula: matricula || null,
      unidade_id: currentResult.unidadeIdFromCnpj,
      data_nascimento: null,
    });
  };

  // Handle ignoring the page (move to next)
  const handleIgnorePage = () => {
    if (currentPageIndex < pageResults.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    } else {
      // Last page ignored, reset
      setPageResults([]);
      setFile(null);
    }
  };

  // Get the current page result
  const currentResult = pageResults[currentPageIndex];

  // Render processing step
  const renderProcessingStep = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-pakere-red" />
          <p className="mt-4 text-lg">Processando PDF, aguarde...</p>
        </div>
      );
    }

    if (pageResults.length === 0 && !file) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          {file ? "Clique em 'Processar PDF' para iniciar." : "Aguardando arquivo para processamento."}
        </div>
      );
    }

    if (!currentResult) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          Processamento concluído!
          <Button onClick={() => {
            setPageResults([]);
            setFile(null);
          }}>
            Processar Novo Documento
          </Button>
        </div>
      );
    }

    // Render current page
    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold">
            Página {currentResult.index + 1} de {pageResults.length}
          </h3>
          <div className="space-y-4">
            {/* Extracted Data */}
            {currentResult.extractedData ? (
              <div className="space-y-2">
                <Label>Dados extraídos:</Label>
                <div className="space-y-1 text-sm">
                  <div><strong>Nome:</strong> {currentResult.extractedData.nome}</div>
                  <div><strong>CPF:</strong> {currentResult.extractedData.cpf}</div>
                  <div><strong>Matrícula:</strong> {currentResult.extractedData.matricula || "N/A"}</div>
                  <div>
                    <strong>Mês/Ano:</strong> 
                    {currentResult.extractedData.mes}/{currentResult.extractedData.ano || "N/A"}
                  </div>
                  <div>
                    <strong>Unidade (do CNPJ):</strong> 
                    {currentResult.unidadeIdFromCnpj ? (
                      unidades.find(u => u.id === currentResult.unidadeIdFromCnpj)?.nome || "Desconhecida"
                    ) : "Não detectada"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum dado extraído desta página.
              </div>
            )}

            {/* Status and Actions */}
            <div className="space-y-4">
              {currentResult.status === "matched" && (
                <>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <Label>Status:</Label>
                    <p className="text-green-600 font-semibold">
                      Colaborador encontrado: {currentResult.matchedProfile?.nome}
                    </p>
                  </div>
                  <Button
                    onClick={handleLinkDocument}
                    disabled={isUploading}
                    className="w-full"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <FileText className="h-4 w-4 mr-2" />
                    )}
                    Vincular Documento
                  </Button>
                </>
              )}

              {currentResult.status === "unmatched" && (
                <>
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <Label>Status:</Label>
                    <p className="text-yellow-600 font-semibold">
                      Colaborador não encontrado automaticamente
                    </p>
                    {currentResult.matchedProfile && (
                      <p className="text-xs text-yellow-500 mt-1">
                        Encontrado colaborador com mesmo CPF, mas unidade diferente: 
                        {currentResult.matchedProfile.nome} (
                          {unidades.find(u => u.id === currentResult.matchedProfile.unidade_id)?.nome}
                        )
                      </p>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Button
                      onClick={handleCreateColaborador}
                      disabled={isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Criar Novo Colaborador
                    </Button>
                    <Button
                      onClick={handleIgnorePage}
                      variant="outline"
                      className="w-full"
                    >
                      Ignorar Página
                    </Button>
                  </div>
                </>
              )}

              {currentResult.status === "duplicate" && (
                <>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <Label>Status:</Label>
                    <p className="text-red-600 font-semibold">
                      Documento já existe para este colaborador, mês e ano
                    </p>
                  </div>
                  <Button
                    onClick={handleIgnorePage}
                    variant="outline"
                    className="w-full"
                  >
                    Ignorar Página
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            onClick={() => {
              if (currentPageIndex > 0) {
                setCurrentPageIndex(currentPageIndex - 1);
              }
            }}
            disabled={currentPageIndex === 0}
            variant="ghost"
          >
            Página Anterior
          </Button>
          <Button
            onClick={() => {
              if (currentPageIndex < pageResults.length - 1) {
                setCurrentPageIndex(currentPageIndex + 1);
              }
            }}
            disabled={currentPageIndex >= pageResults.length - 1}
          >
            Próxima Página
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Importação de Documentos</h1>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-xl font-semibold">
          {documentType === "contracheque" ? "Contracheque" : "Folha de Ponto"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o arquivo PDF para processamento.
        </p>
        <Input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="mt-4"
          disabled={isProcessing}
        />
        <Button
          onClick={handleProcessFile}
          disabled={!file || isProcessing}
          className="mt-4 w-full"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          {isProcessing ? "Processando..." : "Processar PDF"}
        </Button>
      </div>

      {renderProcessingStep()}
    </div>
  );
}