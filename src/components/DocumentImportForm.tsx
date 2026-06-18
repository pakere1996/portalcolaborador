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
import { 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  UserPlus,
  Search,
  Check
} from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";
import { FolhaPontoParser, ContrachequeParser, PageResult } from "@/lib/parsers";
import { cn } from "@/lib/utils";
import { PDFDocument } from "pdf-lib";
import { adminApi } from "@/lib/admin-api";

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
}

interface Cargo {
  id: string;
  nome: string;
}

export function DocumentImportForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [listaCargos, setListaCargos] = useState<Cargo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [manualProfileId, setManualProfileId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuth();

  const documentType = window.location.pathname.includes("ponto") ? "folha_ponto" : "contracheque";

  useEffect(() => {
    if (!user) return;
    
    const loadData = async () => {
      const [pRes, uRes, cRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, cpf, matricula, cargo, unidade_id").eq("ativo", true).order("nome"),
        supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("id, nome").order("nome")
      ]);
      
      setProfiles(pRes.data ?? []);
      setUnidades(uRes.data ?? []);
      setListaCargos(cRes.data ?? []);
    };

    loadData();
  }, [user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPageResults([]);
    setCurrentPage(0);
  };

  const extractPageAsBlob = async (file: File, pageIndex: number): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
  };

  const handleVinculo = async (profileId: string, result: PageResult) => {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);

    try {
      const pageBlob = await extractPageAsBlob(selectedFile, result.pageNumber - 1);
      const fileName = `${result.ano}-${String(result.mes).padStart(2, '0')}_${profileId}_${documentType}.pdf`;
      const storagePath = `documentos/${documentType}/${profileId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, pageBlob, { contentType: "application/pdf", upsert: true });

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("documentos").insert({
        colaborador_id: profileId,
        tipo: documentType,
        mes: result.mes!,
        ano: result.ano!,
        storage_path: storagePath,
        status: "vinculado",
        nome_pdf: fileName
      });

      if (dbError) throw dbError;

      setPageResults(prev => prev.map((r, idx) => 
        idx === currentPage ? { ...r, vinculado: true, matchedProfile: profiles.find(p => p.id === profileId) } : r
      ));

      toast.success("Documento vinculado com sucesso!");
      if (currentPage < pageResults.length - 1) {
        setCurrentPage(prev => prev + 1);
      }
    } catch (err) {
      toast.error("Erro ao vincular documento", { description: (err as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcessar = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const pages = await extractTextFromPDF(selectedFile);
      const parser = documentType === "folha_ponto" ? new FolhaPontoParser() : new ContrachequeParser();
      const results = parser.parse(pages, profiles);

      setPageResults(results);
      toast.success(`${pages.length} páginas processadas.`);
    } catch (err) {
      toast.error("Erro ao processar PDF", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProfiles = profiles.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cpf.includes(searchTerm.replace(/\D/g, ""))
  );

  if (pageResults.length === 0) {
    return (
      <div className="space-y-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
          )}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setSelectedFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => document.getElementById("file-import-input")?.click()}
        >
          <Input id="file-import-input" type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          <Upload className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground font-medium">Arraste um PDF ou clique para selecionar</p>
          <p className="text-xs text-muted-foreground mt-1">O arquivo será dividido por páginas para cada colaborador</p>
        </div>

        {selectedFile && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <div>
                <div className="text-sm font-medium">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedFile(null)} disabled={isProcessing}>
              <X className="size-4" />
            </Button>
          </div>
        )}

        <Button onClick={handleProcessar} disabled={!selectedFile || isProcessing} className="w-full h-12 font-bold">
          {isProcessing ? <><Loader2 className="size-4 mr-2 animate-spin" /> Processando...</> : <><Upload className="size-4 mr-2" /> Iniciar Processamento</>}
        </Button>
      </div>
    );
  }

  const current = pageResults[currentPage];
  const totalPages = pageResults.length;
  const vinculados = pageResults.filter(r => r.vinculado).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-center">
            <div className="text-xs font-bold uppercase text-muted-foreground">Página</div>
            <div className="text-lg font-black">{currentPage + 1} / {totalPages}</div>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase text-muted-foreground">Progresso</div>
          <div className="text-sm font-bold text-primary">{vinculados} de {totalPages} vinculados</div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-primary">
              <Search className="size-4" /> Dados Extraídos
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Nome no PDF</Label>
                <div className="font-medium truncate">{current.nome || "Não identificado"}</div>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">CPF no PDF</Label>
                <div className="font-mono">{current.cpf || "Não identificado"}</div>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Competência</Label>
                <div className="font-medium">{current.mes && current.ano ? `${String(current.mes).padStart(2, '0')}/${current.ano}` : "Não identificada"}</div>
              </div>
              <div>
                <Label className="text-[10px] uppercase text-muted-foreground">Cargo Sugerido</Label>
                <div className="font-medium truncate">{current.suggestedCargoName || "—"}</div>
              </div>
            </div>
          </div>

          {current.vinculado ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3">
              <CheckCircle2 className="size-12 text-emerald-500 mx-auto" />
              <div className="font-bold text-emerald-900">Documento Vinculado</div>
              <p className="text-sm text-emerald-700">Esta página já foi salva para {current.matchedProfile?.nome}.</p>
              <Button variant="outline" className="w-full border-emerald-200 text-emerald-700" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}>
                Próxima Página
              </Button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold flex items-center gap-2">
                <Check className="size-4 text-primary" /> Confirmar Colaborador
              </h3>
              
              {current.matchedProfile ? (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={cn(current.confidence === 1 ? "bg-emerald-500" : "bg-amber-500")}>
                      {current.confidence === 1 ? "Match Exato" : "Sugestão"}
                    </Badge>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Confiança: {Math.round(current.confidence * 100)}%</span>
                  </div>
                  <div className="font-bold text-lg">{current.matchedProfile.nome}</div>
                  <div className="text-xs text-muted-foreground">CPF: {current.matchedProfile.cpf} • Cargo: {current.matchedProfile.cargo}</div>
                  <Button className="w-full" onClick={() => handleVinculo(current.matchedProfile!.id, current)} disabled={isUploading}>
                    {isUploading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Check className="size-4 mr-2" />}
                    Confirmar e Vincular
                  </Button>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-800 font-medium">Nenhum colaborador correspondente encontrado automaticamente.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <UserPlus className="size-4 text-primary" /> Busca Manual
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou CPF..." 
              className="pl-10" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto border rounded-xl divide-y divide-border">
            {filteredProfiles.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado.</div>
            ) : (
              filteredProfiles.map(p => (
                <button 
                  key={p.id} 
                  className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center justify-between group"
                  onClick={() => handleVinculo(p.id, current)}
                  disabled={isUploading || current.vinculado}
                >
                  <div>
                    <div className="font-bold text-sm group-hover:text-primary transition-colors">{p.nome}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{p.cargo || "Sem cargo"} • {p.cpf}</div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}