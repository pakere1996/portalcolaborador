import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2, FileSearch, SearchCode, ClipboardCheck } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";

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
        console.log(`%c[Diagnóstico] Iniciando análise de qualidade: ${file.name}`, "color: #e30f27; font-weight: bold; font-size: 14px;");
        
        try {
          const pages = await extractTextFromPDF(file);
          const diagnosticData: any[] = [];
          
          let namesFound = 0;
          let matriculasFound = 0;
          let cnpjsFound = 0;
          let periodsFound = 0;

          pages.forEach(p => {
            const text = p.text;

            // 1. Regex para CNPJ
            const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
            const cnpj = cnpjMatch ? cnpjMatch[0] : null;

            // 2. Regex para Matrícula (Padrão 10 dígitos, ex: 0000000148)
            const matriculaMatch = text.match(/\b\d{10}\b/);
            const matricula = matriculaMatch ? matriculaMatch[0] : null;

            // 3. Regex para Nome (Entre data de admissão e matrícula)
            // Assume formato: DD/MM/AAAA NOME MATRICULA
            const nameMatch = text.match(/\d{2}\/\d{2}\/\d{4}\s+([A-Z\s]{3,})\s+\d{10}/);
            const nome = nameMatch ? nameMatch[1].trim() : null;

            // 4. Regex para Período de Referência
            const periodMatch = text.match(/Período de referência:\s*de\s*(\d{2}\/\d{2}\/\d{4})\s+(?:a|à)\s+(\d{2}\/\d{2}\/\d{4})/i);
            const periodo = periodMatch ? `${periodMatch[1]} -> ${periodMatch[2]}` : null;

            // Contabilização
            if (nome) namesFound++;
            if (matricula) matriculasFound++;
            if (cnpj) cnpjsFound++;
            if (periodo) periodsFound++;

            diagnosticData.push({
              "Página": p.pageNumber,
              "Nome": nome || "❌ Não encontrado",
              "Matrícula": matricula || "❌ Não encontrada",
              "CNPJ": cnpj || "❌ Não encontrado",
              "Período": periodo || "❌ Não identificado",
              "Caracteres": text.length
            });
          });

          // Exibição da Tabela
          console.table(diagnosticData);

          // Resumo Final
          console.log(`%c[Resumo do Diagnóstico]`, "font-weight: bold; font-size: 12px;");
          console.log(`- Total de páginas: ${pages.length}`);
          console.log(`- Nomes encontrados: ${namesFound}`);
          console.log(`- Matrículas encontradas: ${matriculasFound}`);
          console.log(`- CNPJs encontrados: ${cnpjsFound}`);
          console.log(`- Períodos encontrados: ${periodsFound}`);

          if (namesFound === pages.length && matriculasFound === pages.length) {
            console.log("%c✅ Qualidade de extração excelente (100% de identificação)", "color: #34A853; font-weight: bold;");
          } else {
            console.warn("%c⚠️ Qualidade de extração parcial. Verifique as falhas na tabela acima.", "color: #FBBC05; font-weight: bold;");
          }
          
          toast.info(`Diagnóstico concluído: ${pages.length} páginas analisadas. Verifique o console.`);
        } catch (err) {
          console.error("[Diagnóstico] Erro crítico:", err);
          toast.error("Erro ao executar diagnóstico. Verifique o console.");
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
              {isExtracting ? "Executando diagnóstico..." : "Arraste um arquivo ou clique para selecionar"}
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
        <div className="flex items-center gap-2 text-[10px] text-emerald-600 uppercase font-bold tracking-widest">
          <ClipboardCheck className="size-3" /> Diagnóstico de Qualidade Ativo
        </div>
      </div>
    </div>
  );
}