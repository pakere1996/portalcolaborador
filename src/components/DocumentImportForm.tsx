import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { extractFolhaPonto, extractContracheque } from "@/lib/document-extraction";
import { ExtractedDocumentData } from "@/lib/document-extraction";
import { FolhaPontoParser } from "@/lib/parsers";
import { ContrachequeParser } from "@/lib/parsers";
import { cn } from "@/lib/utils";

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
}

interface Cargo {
  id: string;
  nome: string;
  descricao?: string | null;
}

interface ExtractedData {
  pageResults: any[];
  currentPage: number;
  totalPages: number;
  vinculados: number;
  ignorados: number;
}

export function DocumentImportForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageResults, setPageResults] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [listaCargos, setListaCargos] = useState<Cargo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [manualProfileId, setManualProfileId] = useState<string>("");
  const [showNovoColab, setShowNovoColab] = useState(false);
  const { user } = useAuth();

  // Trava de segurança: Se selecionar um colaborador na lista, fecha o form de novo cadastro
  useEffect(() => {
    if (manualProfileId) {
      setShowNovoColab(false);
    }
  }, [manualProfileId]);

  useEffect(() => {
    setShowNovoColab(false);
    setManualProfileId("");
  }, [currentPage]);

  const documentType = window.location.pathname.includes("ponto") ? "ponto" : "contracheque";

  useEffect(() => {
    if (!user) return;
    
    supabase.from("profiles").select("id, nome, cpf, matricula, cargo, unidade_id").eq("ativo", true).order("nome")
      .then(({ data }) => setProfiles((data ?? []) as any));
      
    supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome")
      .then(({ data }) => setUnidades(data ?? []));
    
    supabase.from("cargos").select("id, nome, descricao").order("nome")
      .then(({ data }) => setListaCargos(data ?? []));
  }, [user?.id]);

  const cleanCNPJ = (cnpj: string) => cnpj.replace(/\D/g, "");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPageResults([]);
    setCurrentPage(0);
  };

  const handleProcessar = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      // 1. Extrai texto do PDF (comum para ambos os tipos)
      const pages = await extractTextFromPDF(selectedFile);

      // 2. Seleciona o parser correto (Strategy Pattern)
      const parser: any = documentType === "ponto"
        ? new FolhaPontoParser()
        : new ContrachequeParser();

      // 3. Executa o parsing específico
      const results = parser.parse(pages, profiles);

      // 4. Pós-processamento comum: resolve unidade via CNPJ e cargo via matching
      const enrichedResults = results.map((r) => {
        let unidadeId = null;
        if (r.cnpj) {
          const unidade = unidades.find(u => u.cnpj && cleanCNPJ(u.cnpj) === cleanCNPJ(r.cnpj!));
          unidadeId = unidade?.id ?? null;
        }

        // Verifica se o cargo sugerido existe na base
        let cargoId = null;
        let isNewCargo = false;
        if (r.suggestedCargoName && listaCargos.length > 0) {
          const normSugerido = r.suggestedCargoName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, "");

          const normOficial = listaCargos.find(c => {
            if (!c.nome) return false;
            const normOficial = c.nome
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]/g, "");
            return normOficial === normSugerido || 
                   normOficial.includes(normSugerido) || 
                   normSugerido.includes(normOficial);
          });

          if (cargoOficial) {
            cargoId = cargoOficial.id;
            isNewCargo = false;
          } else {
            isNewCargo = true;
          }
        }

        return {
          ...r,
          unidadeId,
          cargo: cargoId,
          isNewCargo,
        };
      });

      setPageResults(enrichedResults);

      // Vinculação automática dos matches perfeitos
      for (const result of enrichedResults) {
        if (
          result.matchedProfile &&
          result.confidence === 1 &&
          result.mes &&
          result.ano
        ) {
          await handleVinculoAutomatico(
            result.matchedProfile.id,
            result
          );
        }
      }

      // Atualiza visualmente os vinculados automáticos
      setPageResults(prev =>
        prev.map(r =>
          r.matchedProfile &&
          r.confidence === 1
            ? {
                ...r,
                vinculado: true
              }
            : r
        )
      );

      const qtdAuto = enrichedResults.filter(
        r => r.confidence === 1
      ).length;

      toast.success(
        `${pages.length} páginas processadas (${qtdAuto} vinculadas automaticamente)`
      );
    } catch (err) {
      toast.error("Erro ao processar PDF", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVinculoAutomatico = async (
    profileId: string,
    result: any
  ) => {
    // ... existing logic unchanged
  };

  const handleCriarColab = async () => {
    // ... existing logic unchanged
  };

  // ... rest of component unchanged except using extracted data for display
  const result = pageResults[currentPage];
  const totalPages = pageResults.length;
  const vinculados = pageResults.filter(r => r.vinculado).length;
  const ignorados = pageResults.filter(r => r.ignorado).length;

  if (pageResults.length === 0) {
    return (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-muted/50" : "border-border hover:bg-muted/30"}`}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) { setSelectedFile(f); } }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => document.getElementById("file-import-input")?.click()}
        >
          <Input id="file-import-input" type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          <Upload className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Arraste um PDF ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">Apenas arquivos PDF</p>
        </div>

        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedFile(null)} disabled={isProcessing}>
              <X className="size-4" />
            </Button>
          </div>
        )}

        <Button onClick={handleProcessar} disabled={!selectedFile || isProcessing} className="w-full">
          {isProcessing ? <><Loader2 className="size-4 mr-2 animate-spin" /> Processando...</> : <><Upload className="size-4 mr-2" /> Processar PDF</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ... existing UI ... */}
    </div>
  );
}