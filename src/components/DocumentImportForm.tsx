import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface DocumentImportFormProps {
  onSuccess?: () => void;
}

export function DocumentImportForm({ onSuccess }: DocumentImportFormProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast({
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione um arquivo PDF, DOC, DOCX ou TXT.",
          variant: "destructive",
        });
        return;
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O arquivo deve ter no máximo 10MB.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/documentos/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult({ success: true, message: data.message || "Documento importado com sucesso!" });
        toast({
          title: "Sucesso",
          description: data.message || "Documento importado com sucesso!",
        });
        onSuccess?.();
        setFile(null);
      } else {
        setImportResult({ success: false, message: data.error || "Erro ao importar documento" });
        toast({
          title: "Erro",
          description: data.error || "Erro ao importar documento",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({ success: false, message: "Erro de conexão. Tente novamente." });
      toast({
        title: "Erro",
        description: "Erro de conexão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Documento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="document-file" className="text-sm font-medium">
            Selecionar arquivo
          </Label>
          <div className="relative">
            <input
              id="document-file"
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              disabled={isImporting}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center transition-colors hover:border-primary/50">
              {file ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <AlertCircle className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste um arquivo aqui
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, TXT • Máx. 10MB
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {importResult && (
          <Alert className={importResult.success ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950"}>
            <AlertDescription className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              {importResult.message}
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleImport}
          disabled={!file || isImporting}
          className="w-full"
          size="lg"
        >
          {isImporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Importar Documento
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Os documentos importados serão processados e associados aos colaboradores
          correspondentes com base no conteúdo do arquivo.
        </p>
      </CardContent>
    </Card>
  );
}