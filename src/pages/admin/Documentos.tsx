import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText, Plus } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist";
import { extractCNPJFromText, cleanCNPJ, extractPeriodoFromText } from "@/lib/documentos";

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
  status: "matched" | "unmatched" | "duplicate" | "pending";
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

  const documentType = useMemo(() => {
    const path = window.location.pathname;
    return DOCUMENT_TYPE_MAP[path] || "contracheque";
  }, []);

  const { data: unidades = [] } = useQuery({
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

  const { data: profiles = [] } = useQuery({
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

  const queryClient = useQueryClient();

  const processFileMutation = useMutation({
    mutationFn: async (uploadedFile: File) => {
      setIsProcessing(true);
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const numPages = pdfDoc.getPageCount();
      const results: PageResult[] = [];

      for (let i = 0; i < numPages; i++) {
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        const singlePagePdfBytes = await singlePagePdf.save();
        const blob = new Blob([singlePagePdfBytes], { type: "application/pdf" });
        const singlePageFile = new File([blob], `page_${i}.pdf`, { type: "application/pdf" });

        const extractedData = await extractDataFromPdfFile(singlePageFile, documentType);

        const unidadeIdFromCnpj = await getUnidadeIdFromCnpjInText(
          extractedData?.text || "",
          unidades
        );

        results.push({
          index: i,
          extractedData: extractedData?.data || null,
          status: "pending",
          matchedProfile: null,
          unidadeIdFromCnpj,
          onePageBlob: blob,
        });
      }

      setIsProcessing(false);
      return results;
    },
    onSuccess: async (results) => {
      const updatedResults = await Promise.all(results.map(async (result) => {
        if (!result.extractedData) {
          return { ...result, status: "unmatched" as const };
        }

        const { cpf, unidade_id: extractedUnidadeId, mes, ano } = result.extractedData;

        let matchedProfile: Profile | null = null;
        if (cpf && extractedUnidadeId && mes !== null && ano !== null) {
          matchedProfile = profiles.find(
            (p) =>
              p.cpf === cpf &&
              p.unidade_id === extractedUnidadeId &&
              p.ativo === true
          ) || null;
        }

        if (matchedProfile) {
          const { count } = await supabase
            .from("documentos")
            .select("id", { count: "exact", head: true })
            .eq("colaborador_id", matchedProfile.id)
            .eq("tipo", documentType)
            .eq("mes", mes)
            .eq("ano", ano);

          if (count && count > 0) {
            return { ...result, status: "duplicate" as const, matchedProfile };
          }
          return { ...result, status: "matched" as const, matchedProfile };
        }

        const profileByCpf = profiles.find(
          (p) => p.cpf === cpf && p.ativo === true
        );

        return {
          ...result,
          status: "unmatched" as const,
          matchedProfile: profileByCpf || null,
        };
      }));

      setPageResults(updatedResults);
      setCurrentPageIndex(0);
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error("Erro ao processar o arquivo", { description: error.message });
    },
  });

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
      if (currentPageIndex < pageResults.length - 1) {
        setCurrentPageIndex(currentPageIndex + 1);
      } else {
        setPageResults([]);
        setFile(null);
      }
    },
    onError: (error) => {
      setIsUploading(false);
      toast.error("Erro ao vincular documento", { description: error.message });
    },
  });

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
          cargo: "Colaborador",
        })
        .select();

      if (error) throw error;
      return data[0];
    },
    onSuccess: (newProfile) => {
      toast.success("Colaborador criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setPageResults((prev) => {
        return prev.map((result, index) => {
          if (index === currentPageIndex) {
            return {
              ...result,
              status: "matched" as const,
              matchedProfile: newProfile,
            };
          }
          return result;
        });
      });
    },
    onError: (error) => {
      toast.error("Erro ao criar colaborador", { description: error.message });
    },
  });

  const extractPdfTextFromFile = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const pageTexts: string[] = [];

    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");

      if (pageText.trim()) {
        pageTexts.push(pageText);
      }
    }

    return pageTexts.join("\n");
  };

  const extractNomeFromText = (text: string): string | null => {
    const lines = text
      .replace(/\r/g, "\n")
      .replace(/\f/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+/g, " ");
      const match = line.match(
        /([A-ZÀ-ÚÃÕÂÊÔÁÉÍÓÚÇ][A-ZÀ-ÚÃÕÂÊÔÁÉÍÓÚÇ\s.'-]{2,})\s+(\d{10})\b/u
      );

      if (!match) continue;

      let nome = match[1].trim();
      nome = nome
        .replace(/^(NOME|FUNCION[ÁA]RIO|COLABORADOR)\s*[:\-]?/i, "")
        .trim()
        .replace(/\s{2,}/g, " ");

      if (nome.split(/\s+/).length >= 2) {
        return nome;
      }
    }

    return null;
  };

  const extractCpfFromText = (text: string): string | null => {
    const cpfMatch = text.match(/CPF\s*[:\-]?\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i);
    return cpfMatch ? cpfMatch[1] : null;
  };

  const extractDataFromPdfFile = async (
    file: File,
    docType: "contracheque" | "folha_ponto"
  ): Promise<{ data: ExtractedData | null; text: string } | null> => {
    try {
      const text = await extractPdfTextFromFile(file);
      const nome = extractNomeFromText(text);
      const cpf = extractCpfFromText(text);
      const periodo = extractPeriodoFromText(text, docType);
      const cnpj = extractCNPJFromText(text);

      let unidade_id: string | null = null;
      if (cnpj) {
        const cleanedCnpj = cleanCNPJ(cnpj);
        const unidade = unidades.find((u) => u.cnpj && cleanCNPJ(u.cnpj) === cleanedCnpj);
        unidade_id = unidade?.id ?? null;
      }

      const extractedData: ExtractedData = {
        nome: nome ?? "",
        cpf: cpf ?? "",
        matricula: "",
        unidade_id,
        mes: periodo?.mes ?? null,
        ano: periodo?.ano ?? null,
      };

      return { data: extractedData, text };
    } catch (error) {
      console.error("Erro ao extrair dados do PDF:", error);
      return null;
    }
  };

  const getUnidadeIdFromCnpjInText = async (
    text: string,
    unidadesList: Unidade[]
  ): Promise<string | null> => {
    const cnpj = extractCNPJFromText(text);
    if (!cnpj) return null;

    const cleaned = cleanCNPJ(cnpj);
    const unidade = unidadesList.find(
      (u) => u.cnpj && cleanCNPJ(u.cnpj) === cleaned
    );

    return unidade?.id ?? null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPageResults([]);
      setCurrentPageIndex(0);
    }
  };

  const handleProcessFile = () => {
    if (!file) return;
    processFileMutation.mutate(file);
  };

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

  const handleCreateColaborador = () => {
    const currentResult = pageResults[currentPageIndex];
    if (!currentResult) return;

    const { nome, cpf, matricula } = currentResult.extractedData || {};
    createColaboradorMutation.mutate({
      nome: nome || "Nome não encontrado",
      cpf: cpf || "000.000.000-00",
      matricula: matricula || null,
      unidade_id: currentResult.unidadeIdFromCnpj,
      data_nascimento: null,
    });
  };

  const handleIgnorePage = () => {
    if (currentPageIndex < pageResults.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    } else {
      setPageResults([]);
      setFile(null);
    }
  };

  const currentResult = pageResults[currentPageIndex];

  const renderProcessingStep = () => {
    if (isProcessing) {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

    if (!currentResult && pageResults.length > 0) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          Processamento concluído!
          <Button onClick={() => {
            setPageResults([]);
            setFile(null);
          }} className="mt-4">
            Processar Novo Documento
          </Button>
        </div>
      );
    }

    if (!currentResult) return null;

    return (
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-lg font-semibold">
            Página {currentResult.index + 1} de {pageResults.length}
          </h3>
          <div className="space-y-4">
            {currentResult.extractedData ? (
              <div className="space-y-2">
                <Label>Dados extraídos:</Label>
                <div className="space-y-1 text-sm">
                  <div><strong>Nome:</strong> {currentResult.extractedData.nome || "N/A"}</div>
                  <div><strong>CPF:</strong> {currentResult.extractedData.cpf || "N/A"}</div>
                  <div><strong>Matrícula:</strong> {currentResult.extractedData.matricula || "N/A"}</div>
                  <div>
                    <strong>Mês/Ano:</strong> 
                    {currentResult.extractedData.mes && currentResult.extractedData.ano
                      ? `${String(currentResult.extractedData.mes).padStart(2, "0")}/${currentResult.extractedData.ano}`
                      : "N/A"}
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