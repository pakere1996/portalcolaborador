import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, Loader2, FileSearch, SearchCode, ClipboardCheck } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";
import { extractCPF, findBestProfileMatch, type ProfileForMatching } from "@/lib/documentos-matching";

const statusLabel: Record<"automatico" | "sugerido" | "revisao", string> = {
  automatico: "automático",
  sugerido: "sugerido",
  revisao: "revisão",
};

export function DocumentImportForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [profiles, setProfiles] = useState<ProfileForMatching[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("id, nome, cpf, matricula")
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao carregar perfis para matching", { description: error.message });
          return;
        }

        setProfiles((data ?? []) as ProfileForMatching[]);
      });
  }, [user?.id]);

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
          let cpfsFound = 0;
          let matriculasFound = 0;
          let cnpjsFound = 0;
          let periodsFound = 0;
          let automaticMatches = 0;
          let suggestedMatches = 0;
          let reviewMatches = 0;

          pages.forEach((p) => {
            const text = p.text;

            const cpf = extractCPF(text);
            const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
            const cnpj = cnpjMatch ? cnpjMatch[0] : null;

            const matriculaMatch = text.match(/\b0+\d+\b/);
            const matricula = matriculaMatch ? matriculaMatch[0] : null;

            const nameMatch = text.match(/\d{2}\/\d{2}\/\d{4}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+?)\s+\d+\s+[A-Z]/);
            let nome = null;
            if (nameMatch && nameMatch[1]) {
              nome = nameMatch[1].trim().replace(/\s+/g, " ");
            }

            const periodMatch = text.match(/Per[ií]odo de refer[eê]ncia:\s*de\s*(\d{2}\/\d{2}\/\d{4})\s+(?:a|à)\s+(\d{2}\/\d{2}\/\d{4})/i);

            let dataInicial = null;
            let dataFinal = null;
            let periodoIdentificado = false;

            if (periodMatch) {
              dataInicial = periodMatch[1];
              dataFinal = periodMatch[2];
              periodoIdentificado = true;
            } else {
              const fallbackMatch = text.match(/(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\/\d{2}\/\d{4})/);
              if (fallbackMatch) {
                dataInicial = fallbackMatch[1];
                dataFinal = fallbackMatch[2];
                periodoIdentificado = true;
              }
            }

            const match = findBestProfileMatch(nome, cpf, profiles);

            if (nome) namesFound++;
            if (cpf) cpfsFound++;
            if (matricula) matriculasFound++;
            if (cnpj) cnpjsFound++;
            if (periodoIdentificado) periodsFound++;
            if (match.status === "automatico") automaticMatches++;
            if (match.status === "sugerido") suggestedMatches++;
            if (match.status === "revisao") reviewMatches++;

            diagnosticData.push({
              Página: p.pageNumber,
              "Nome PDF": nome || "❌ Não encontrado",
              "CPF PDF": cpf || "❌ Não encontrado",
              "Matrícula (complementar)": matricula || "—",
              "CNPJ": cnpj || "❌ Não encontrado",
              "Data Inicial": dataInicial || "❌",
              "Data Final": dataFinal || "❌",
              "Nome Perfil Encontrado": match.profile?.nome ?? "❌ Não encontrado",
              "MatchBy": match.matchBy ?? "—",
              "Confidence": `${Math.round(match.confidence * 100)}%`,
              "Status": statusLabel[match.status],
              "Caracteres": text.length,
            });
          });

          console.table(diagnosticData);

          const matchingSummary = pages.map((p) => {
            const text = p.text;
            const nome = text.match(/\d{2}\/\d{2}\/\d{4}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+?)\s+\d+\s+[A-Z]/)?.[1]?.trim();
            const cpf = extractCPF(text);
            const match = findBestProfileMatch(nome, cpf, profiles);

            return {
              Página: p.pageNumber,
              "Nome PDF": nome || "Não encontrado",
              "CPF PDF": cpf || "Não encontrado",
              "Nome Perfil Encontrado": match.profile?.nome ?? "Não encontrado",
              "MatchBy": match.matchBy ?? "—",
              "Confidence": `${Math.round(match.confidence * 100)}%`,
              "Status": statusLabel[match.status],
            };
          });

          const total = pages.length;
          const pctNome = total > 0 ? ((namesFound / total) * 100).toFixed(1) : "0";
          const pctCPF = total > 0 ? ((cpfsFound / total) * 100).toFixed(1) : "0";
          const pctMatricula = total > 0 ? ((matriculasFound / total) * 100).toFixed(1) : "0";
          const pctCnpj = total > 0 ? ((cnpjsFound / total) * 100).toFixed(1) : "0";
          const pctPeriodo = total > 0 ? ((periodsFound / total) * 100).toFixed(1) : "0";

          console.log("%c[Resumo do Diagnóstico]", "font-weight: bold; font-size: 12px;");
          console.log(`- Total de páginas: ${total}`);
          console.log(`- Nomes identificados: ${namesFound}/${total} (${pctNome}%)`);
          console.log(`- CPFs identificados: ${cpfsFound}/${total} (${pctCPF}%)`);
          console.log(`- Matrículas identificadas: ${matriculasFound}/${total} (${pctMatricula}%) - campo complementar, não usado no matching`);
          console.log(`- CNPJs identificados: ${cnpjsFound}/${total} (${pctCnpj}%)`);
          console.log(`- Períodos identificados: ${periodsFound}/${total} (${pctPeriodo}%)`);
          console.log(`- Matches automáticos: ${automaticMatches}`);
          console.log(`- Matches sugeridos: ${suggestedMatches}`);
          console.log(`- Revisão manual: ${reviewMatches}`);

          console.log("%c[Resumo do Matching]", "font-weight: bold; font-size: 12px;");
          console.table(matchingSummary);

          const allCritical = namesFound === total && cpfsFound === total;
          if (allCritical) {
            console.log("%c✅ EXCELENTE: Nome + CPF identificados em todas as páginas. Matching prioritário por CPF.", "color: #34A853; font-weight: bold;");
          } else {
            console.warn("%c⚠️ ATENÇÃO: Verifique páginas com CPF ausente ou baixa similaridade de nome.", "color: #FBBC05; font-weight: bold;");
          }

          toast.info(`Diagnóstico concluído: ${total} páginas. Matching por CPF/nome atualizado.`);
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
        <div className="flex items-center gap-2 text-[10px] text-primary/70 uppercase font-bold tracking-widest">
          <SearchCode className="size-3" /> Matching por CPF e Nome
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
          <FileSearch className="size-3" /> Matrícula apenas complementar
        </div>
        <div className="text-xs text-muted-foreground">
          Perfis carregados para matching: {profiles.length}
        </div>
      </div>
    </div>
  );
}