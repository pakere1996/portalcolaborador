import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2, FileSearch, SearchCode } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";
import { extractCNPJFromText, extractPeriodoFromText } from "@/lib/documentos";

export function DocumentImportForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const { user } = useAuth();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      if (file.type === "application/pdf") {
        setIsExtracting(true);
        console.log(`%c[Fase1] Iniciando leitura do arquivo: ${file.name}`, "color: #e30f27; font-weight: bold;");
        
        try {
          const pages = await extractTextFromPDF(file);
          console.log(`[Fase1] Total de páginas: ${pages.length}`);
          
          pages.forEach(p => {
            // Logs da Fase 1
            if (!p.text) {
              console.warn(`[Fase1] Nenhum texto encontrado na página ${p.pageNumber}`);
            } else {
              console.log(`%cPágina ${p.pageNumber}:`, "font-weight: bold;");
              console.log(`- Quantidade de caracteres: ${p.text.length}`);
              console.log(`- Primeiros 300 caracteres: ${p.text.substring(0, 300)}...`);

              // FASE 2: Validação de Extração
              console.log(`%c[Fase2] Processando extração da Página ${p.pageNumber}`, "color: #4285F4; font-weight: bold;");
              
              const periodo = extractPeriodoFromText(p.text, "folha_ponto");
              const cnpj = extractCNPJFromText(p.text);

              console.log(`Período identificado: ${periodo ? `${String(periodo.mes).padStart(2, '0')}/${periodo.ano}` : "Não identificado"}`);
              console.log(`CNPJ identificado: ${cnpj || "Não identificado"}`);

              // Log especial para período bruto (padrão comum em folhas de ponto)
              const rawPeriodMatch = p.text.match(/de\s+(\d{2}\/\d{2}\/\d{4})\s+(?:a|à)\s+(\d{2}\/\d{2}\/\d{4})/i);
              if (rawPeriodMatch) {
                console.log(`%c[Fase2] Período bruto encontrado: ${rawPeriodMatch[1]} -> ${rawPeriodMatch[2]}`, "color: #FBBC05; font-weight: bold;");
              }
            }
          });
          
          toast.info(`PDF processado: ${pages.length} páginas analisadas. Verifique o console.`);
        } catch (err) {
          console.error("[Fase1/2] Erro no processamento do PDF:", err);
          toast.error("Erro ao analisar PDF. Verifique o console.");
        } finally {
          setIsExtracting(false);
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const mockEvent = { target: { files: [file] } } as any;
      handleFileChange(mockEvent);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const { data, error } = await supabase.functions.invoke("import-documentos", {
        body: formData,
      });

      if (error) throw error;
      
      toast.success(data.message || "Documento importado com sucesso!");
      setSelectedFile(null);
    } catch (error: any) {
      toast.error("Erro ao importar documento", {
        description: error.message || "Falha na comunicação com o servidor.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Arquivo do documento</Label>
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging ? "border-primary bg-muted/50" : "border-border hover:bg-muted/30"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById("file-import-input")?.click()}
        >
          <Input
            id="file-import-input"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            {isExtracting ? (
              <Loader2 className="size-8 text-primary animate-spin" />
            ) : (
              <Upload className="size-8 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">
              {isExtracting ? "Analisando conteúdo..." : "Arraste um arquivo ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, JPG, PNG
            </p>
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{selectedFile.name}</div>
              <div className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            type="button"
            disabled={isUploading || isExtracting}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      <Button
        onClick={() => void handleUpload()}
        disabled={!selectedFile || isUploading || isExtracting}
        className="w-full"
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Upload className="size-4 mr-2" />
            Importar Documento
          </>
        )}
      </Button>

      <div className="pt-2 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
          <FileSearch className="size-3" /> Fase 1: Extração de Texto Ativa
        </div>
        <div className="flex items-center gap-2 text-[10px] text-blue-500 uppercase font-bold tracking-widest">
          <SearchCode className="size-3" /> Fase 2: Validação de Inteligência Ativa
        </div>
      </div>
    </div>
  );
}