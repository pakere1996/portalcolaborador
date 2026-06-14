import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { importDocumentos } from "@/routes/api/admin/documentos/import";
import { getSupabaseClient } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X } from "lucide-react";

export function DocumentImportForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const supabase = getSupabaseClient();
      
      // Upload to storage first
      const fileName = file.name;
      const fileExt = fileName.split('.').pop() || 'pdf';
      const storagePath = `documentos/importados/${Date.now()}-${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Then register in database
      return importDocumentos({
        fileName,
        fileSize: file.size,
        filePath: uploadData.path,
      });
    },
    onSuccess: () => {
      toast.success("Documento importado com sucesso!");
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao importar documento: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Arquivo do documento</Label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-muted/50' : 'border-muted'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Input
            id="file-input"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.png"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arraste um arquivo ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, DOCX, JPG, PNG
            </p>
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">{selectedFile.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Button
        onClick={() => selectedFile && mutation.mutate(selectedFile)}
        disabled={!selectedFile || mutation.isPending}
        className="w-full"
      >
        {mutation.isPending ? "Importando..." : "Importar Documento"}
      </Button>
    </div>
  );
}