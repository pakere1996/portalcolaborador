import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2, FileSearch } from "lucide-react";
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
      
      // FASE 1: Comprovação de Leitura de PDF
      if (file.type === "application/pdf") {
        setIsExtracting(true);
        console.log(`%c[Fase1] Iniciando leitura do arquivo: ${file.name}`, "color: #e30f27; font-weight: bold;");
        
        try {
          const pages = await extractTextFromPDF(file);
          console.log(`[Fase1] Total de páginas: ${pages.length}`);
          
          pages.forEach(p => {
            if (!p.text) {
              console.warn(`[Fase1] Nenhum texto encontrado na página ${p.pageNumber}`);
            } else {
              console.log(`%cPágina ${p.pageNumber}:`, "font-weight: bold;");
              console.log(`- Quantidade de caracteres: ${p.text.length}`);
              console.log(`- Primeiros 300 caracteres: ${p.text.substring(0, 300)}...`);
            }
          });
          
          toast.info(`PDF lido com sucesso: ${pages.length} páginas processadas.`);
        } catch (err) {
          console.error("[Fase1] Erro na extração de texto do PDF:", err);
          toast.error("Erro ao ler conteúdo do PDF. Verifique o console.");
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
              {isExtracting ? "Lendo conteúdo do PDF..." : "Arraste um arquivo ou clique para selecionar"}
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

      <div className="pt-2 flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
        <FileSearch className="size-3" /> Fase 1: Extração de Texto Ativa
      </div>
    </div>
  );
}