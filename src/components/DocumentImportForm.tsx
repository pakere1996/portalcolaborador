import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { extractTextFromPDF } from "@/lib/pdf-utils";
import { extractCPF, findBestProfileMatch, type ProfileForMatching } from "@/lib/documentos-matching";
import { adminApi } from "@/lib/admin-api";

interface PageResult {
  pageNumber: number;
  text: string;
  nome: string | null;
  cpf: string | null;
  cnpj: string | null;
  mes: number | null;
  ano: number | null;
  unidadeId: string | null;
  cargo: string | null; // Armazena o ID do cargo oficial
  dataAdmissao: string | null;
  matchStatus: "automatico" | "sugerido" | "revisao";
  matchedProfile: ProfileForMatching | null;
  confidence: number;
  isNewCargo: boolean;
  suggestedCargoName: string | null;
  vinculado: boolean;
  ignorado: boolean;
}

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

// 🌟 FUNÇÃO AUXILIAR: Remove acentos, espaços, pontuações e caixa alta para garantir o match perfeito de strings
const normalizeTextForMatch = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-z0-9]/g, "")       // Remove espaços, pontos, traços e barras horizontais
    .trim();
};

export function DocumentImportForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pageResults, setPageResults] = useState<PageResult[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [profiles, setProfiles] = useState<ProfileForMatching[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [listaCargos, setListaCargos] = useState<Cargo[]>([]); 
  const [isUploading, setIsUploading] = useState(false);
  const [manualProfileId, setManualProfileId] = useState<string>("");
  
  const [novoColabForm, setNovoColabForm] = useState({
    nome: "", cpf: "", cargo: "", unidadeId: "", senha: "",
    folgaFixa: "none", dataAdmissao: "", dataNascimento: "",
    whatsapp: "", perfil_acesso: "colaborador", matricula: ""
  });
  const [showNovoColab, setShowNovoColab] = useState(false);
  const { user } = useAuth();

  const documentType = window.location.pathname.includes("ponto") ? "ponto" : "contracheque";

  useEffect(() => {
    if (!user) return;
    
    supabase.from("profiles").select("id, nome, cpf, matricula").eq("ativo", true).order("nome")
      .then(({ data }) => setProfiles((data ?? []) as ProfileForMatching[]));
      
    supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome")
      .then(({ data }) => setUnidades(data ?? []));

    supabase.from("cargos").select("id, nome, descricao").order("nome")
      .then(({ data }) => setListaCargos(data ?? []));
  }, [user?.id]);

  const cleanCNPJ = (cnpj: string) => cnpj.replace(/\D/g, "");

  const extractPeriodo = (text: string): { mes: number; ano: number } | null => {
    const regexPonto = /Per[ií]odo de refer[eê]ncia:\s*de\s*(\d{2}\/\d{2}\/\d{4})\s+(?:a|à)\s+(\d{2}\/\d{2}\/\d{4})/i;
    const matchPonto = text.match(regexPonto);
    if (matchPonto) {
      const [, dataInicio] = matchPonto;
      const [, mes, ano] = dataInicio.split("/");
      return { mes: parseInt(mes), ano: parseInt(ano) };
    }
    const meses: Record<string, number> = {
      janeiro: 1, fevereiro: 2, março: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    };
    const regexContracheque = /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/i;
    const matchContracheque = text.match(regexContracheque);
    if (matchContracheque) {
      return { mes: meses[matchContracheque[1].toLowerCase()], ano: parseInt(matchContracheque[2]) };
    }
    return null;
  };

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
      const pages = await extractTextFromPDF(selectedFile);
      const results: PageResult[] = pages.map((p) => {
        const text = p.text;

        const nameMatch = text.match(/\d{2}\/\d{2}\/\d{4}\s+([A-ZÀ-ÚÇÁÉÍÓÚÃÕÂÊÔ\s]+?)\s+\d+\s+[A-Z]/);
        const nome = nameMatch ? nameMatch[1].trim().replace(/\s+/g, " ") : null;
        const cpf = extractCPF(text);
        
        const match = findBestProfileMatch(nome, cpf, profiles);
        const perfilVinculado = match.profile;

        // =================================================================
        // PROCESSAMENTO DE CARGO REFORÇADO COM DUPLA CAMADA DE SEGURANÇA
        // =================================================================
        let cargoFinalId = null;
        let isNewCargo = false;
        let suggestedCargoName = null;

        // Camada 1: Proximidade Linear por Regex tradicional
        const cargoMatch = text.match(/(?:cargo|fun[çc][ãa]o|cargo\/fun[çc][ãa]o)[:\s-]*([A-Za-zÀ-ÿÇç\u00a0\s\./-]+)/i);
        let cargoTexto = cargoMatch ? cargoMatch[1].replace(/\u00a0/g, " ").trim() : null;
        
        if (cargoTexto) {
          cargoTexto = cargoTexto.split(/(?:setor|dep|unidade|c\.|registro|s[eé]rie|hor[aá]rio|escala|cbo|pis|ctps|data|\s{2,})/i)[0].trim();
        }

        const cargoOrigem = cargoTexto || perfilVinculado?.cargo;

        if (cargoOrigem) {
          const toTitleCase = (s: string) => s.toLowerCase().replace(/(?:^|\s)\S/g, l => l.toUpperCase());
          suggestedCargoName = toTitleCase(cargoOrigem.toString());

          if (listaCargos && listaCargos.length > 0) {
            const normOrigem = normalizeTextForMatch(cargoOrigem.toString());

            const cargoOficialEncontrado = listaCargos.find(c => {
              if (!c.nome) return false;
              const normOficial = normalizeTextForMatch(c.nome);
              return normOficial === normOrigem || normOficial.includes(normOrigem) || normOrigem.includes(normOficial);
            });

            if (cargoOficialEncontrado) {
              cargoFinalId = cargoOficialEncontrado.id;
              isNewCargo = false;
            } else {
              isNewCargo = true;
            }
          } else {
            isNewCargo = true;
          }
        }

        // Camada 2 (🌟 ESCAPE FALLBACK): Varredura Geral à prova de quebra de layout de coluna
        // Se a associação direta quebrou devido ao espaçamento do PDF, vasculhamos a página inteira atrás de cargos da base
        if (!cargoFinalId && listaCargos && listaCargos.length > 0) {
          const normFullText = normalizeTextForMatch(text);
          
          const cargoPorVarredura = listaCargos.find(c => {
            if (!c.nome) return false;
            const normOficial = normalizeTextForMatch(c.nome);
            // Evita termos genéricos curtos demais (ex: menos de 3 letras) para não gerar falsos positivos
            return normOficial.length >= 3 && normFullText.includes(normOficial);
          });

          if (cargoPorVarredura) {
            cargoFinalId = cargoPorVarredura.id;
            suggestedCargoName = cargoPorVarredura.nome;
            isNewCargo = false;
          }
        }

        // EXTRAÇÃO DE DATA DE ADMISSÃO
        let dataAdmissao = null;
        const admissaoDireto = text.match(/(?:admiss[ãa]o|admissao|adm)[:\s]*[^0-9/]{0,20}(\d{2})\/(\d{2})\/(\d{4})/i);
        
        if (admissaoDireto) {
          dataAdmissao = `${admissaoDireto[3]}-${admissaoDireto[2]}-${admissaoDireto[1]}`;
        } else {
          const todasAsDatas = text.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
          if (todasAsDatas.length > 0) {
            const periodoInfo = extractPeriodo(text);
            const anoPeriodo = periodoInfo?.ano ? parseInt(periodoInfo.ano) : null;
            let dataCandidata = null;

            if (anoPeriodo) {
              dataCandidata = todasAsDatas.find(d => parseInt(d.split('/')[2]) < anoPeriodo);
            }
            if (!dataCandidata) {
              const ordenadas = [...todasAsDatas].sort((a, b) => {
                const [dA, mA, aA] = a.split('/').map(Number);
                const [dB, mB, aB] = b.split('/').map(Number);
                return new Date(aA, mA - 1, dA).getTime() - new Date(aB, mB - 1, dB).getTime();
              });
              dataCandidata = ordenadas[0];
            }
            if (dataCandidata) {
              const [dia, mes, ano] = dataCandidata.split('/');
              dataAdmissao = `${ano}-${mes}-${dia}`;
            }
          }
        }

        const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        const cnpj = cnpjMatch ? cnpjMatch[0] : null;
        const unidade = cnpj ? unidades.find(u => u.cnpj && cleanCNPJ(u.cnpj) === cleanCNPJ(cnpj)) : null;
        const periodo = extractPeriodo(text);

        return {
          pageNumber: p.pageNumber,
          text,
          nome,
          cpf,
          cnpj,
          mes: periodo?.mes ?? null,
          ano: periodo?.ano ?? null,
          unidadeId: unidade?.id ?? null,
          matchStatus: match.status,
          matchedProfile: perfilVinculado,
          confidence: match.confidence,
          cargo: cargoFinalId, 
          isNewCargo: isNewCargo, 
          suggestedCargoName: suggestedCargoName,
          dataAdmissao: dataAdmissao,
          vinculado: false,
          ignorado: false,
        };
      });

      setPageResults(results);
      setCurrentPage(0);
      toast.success(`${pages.length} páginas processadas!`);
    } catch (err) {
      toast.error("Erro ao processar PDF", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCadastrarCargoRapido = async (nomeCargo: string) => {
    if (!nomeCargo) return;
    try {
      const { data, error } = await supabase
        .from("cargos")
        .insert({ nome: nomeCargo })
        .select()
        .single();

      if (error) throw error;

      setListaCargos(prev => [...prev, data]);
      setNovoColabForm(f => ({ ...f, cargo: data.id }));
      setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, cargo: data.id, isNewCargo: false } : r));
      
      toast.success(`Cargo "${nomeCargo}" adicionado à base de dados!`);
    } catch (err) {
      toast.error("Erro ao cadastrar cargo no banco", { description: (err as Error).message });
    }
  };

  const handleVincular = async (profileId: string) => {
    const result = pageResults[currentPage];
    if (!result || !result.mes || !result.ano) {
      toast.error("Mês/ano não identificado nesta página.");
      return;
    }
    setIsUploading(true);
    try {
      const { count } = await supabase.from("documentos")
        .select("id", { count: "exact", head: true })
        .eq("colaborador_id", profileId)
        .eq("tipo", documentType)
        .eq("mes", result.mes)
        .eq("ano", result.ano);

      if (count && count > 0) {
        toast.error("Documento duplicado — já existe para este colaborador, mês e ano.");
        setIsUploading(false);
        return;
      }

      const storagePath = `documentos/${documentType}/${profileId}/${result.ano}_${String(result.mes).padStart(2, "0")}_p${result.pageNumber}.pdf`;
      const { error: uploadError } = await supabase.storage.from("documentos")
        .upload(storagePath, selectedFile!, { contentType: "application/pdf", upsert: false });
      if (uploadError && !uploadError.message.includes("already exists")) throw uploadError;

      const { error: insertError } = await supabase.from("documentos").insert({
        colaborador_id: profileId,
        tipo: documentType,
        mes: result.mes,
        ano: result.ano,
        storage_path: storagePath,
        status: "disponivel",
        nome_pdf: selectedFile!.name,
      });
      if (insertError) throw insertError;

      setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, vinculado: true, matchedProfile: profiles.find(p => p.id === profileId) ?? r.matchedProfile } : r));
      toast.success("Documento vinculado com sucesso!");
      setManualProfileId("");

      const next = pageResults.findIndex((r, i) => i > currentPage && !r.vinculado && !r.ignorado);
      if (next !== -1) setCurrentPage(next);
    } catch (err) {
      toast.error("Erro ao vincular", { description: (err as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleIgnorar = () => {
    setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, ignorado: true } : r));
    const next = pageResults.findIndex((r, i) => i > currentPage && !r.vinculado && !r.ignorado);
    if (next !== -1) setCurrentPage(next);
  };

  const handleCriarColab = async () => {
    if (!novoColabForm.nome || !novoColabForm.cpf || !novoColabForm.cargo || !novoColabForm.unidadeId) {
      toast.error("Nome, CPF, cargo e unidade são obrigatórios.");
      return;
    }
    setIsUploading(true);
    try {
      const cleanCpf = novoColabForm.cpf.replace(/\D/g, "");
      const authUser = await adminApi.createUser({
        nome: novoColabForm.nome.trim(),
        cpf: cleanCpf,
        email: `${cleanCpf}@pakere.com.br`,
        senha: novoColabForm.senha || cleanCpf.slice(-6),
        cargo: novoColabForm.cargo, 
        dataAdmissao: novoColabForm.dataAdmissao || null,
        dataNascimento: novoColabForm.dataNascimento || null,
        folgaFixaSemana: novoColabForm.folgaFixa === "none" ? null : Number(novoColabForm.folgaFixa),
        role: novoColabForm.perfil_acesso,
      });
      
      const { error: profErr } = await supabase.from("profiles").update({
        unidade_id: novoColabForm.unidadeId,
        whatsapp: novoColabForm.whatsapp || null,
        matricula: novoColabForm.matricula || null
      }).eq("id", authUser.userId);
      if (profErr) throw profErr;

      const newProfile: ProfileForMatching = { id: authUser.userId, nome: novoColabForm.nome, cpf: cleanCpf, matricula: novoColabForm.matricula || null };
      setProfiles(prev => [...prev, newProfile]);
      setShowNovoColab(false);
      setNovoColabForm({ nome: "", cpf: "", cargo: "", unidadeId: "", senha: "", folgaFixa: "none", dataAdmissao: "", dataNascimento: "", whatsapp: "", perfil_acesso: "colaborador", matricula: "" });
      toast.success("Colaborador criado! Agora vincule o documento.");
      setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, matchedProfile: newProfile, matchStatus: "automatico" } : r));
    } catch (err) {
      toast.error("Erro ao criar colaborador", { description: (err as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

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
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">{selectedFile?.name}</span>
        <span className="text-muted-foreground">{vinculados} vinculados · {ignorados} ignorados · {totalPages - vinculados - ignorados} pendentes</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${((vinculados + ignorados) / totalPages) * 100}%` }} />
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">Página {result?.pageNumber} de {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage === totalPages - 1}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {result && (
        <div className={`rounded-2xl border-2 p-5 space-y-4 ${result.vinculado ? "border-green-300 bg-green-50" : result.ignorado ? "border-gray-200 bg-gray-50 opacity-60" : result.matchStatus === "automatico" ? "border-green-200 bg-green-50/50" : result.matchStatus === "sugerido" ? "border-yellow-200 bg-yellow-50/50" : "border-red-200 bg-red-50/50"}`}>
          
          <div className="flex items-center gap-2">
            {result.vinculado ? <CheckCircle2 className="size-5 text-green-600" /> : result.ignorado ? <XCircle className="size-5 text-gray-400" /> : result.matchStatus === "automatico" ? <CheckCircle2 className="size-5 text-green-600" /> : result.matchStatus === "sugerido" ? <AlertTriangle className="size-5 text-yellow-600" /> : <XCircle className="size-5 text-red-500" />}
            <span className="font-semibold text-sm">
              {result.vinculado ? "✅ Vinculado" : result.ignorado ? "⛔ Ignorado" : result.matchStatus === "automatico" ? "✅ Match automático" : result.matchStatus === "sugerido" ? "⚠️ Match sugerido" : "❌ Revisão manual necessária"}
            </span>
            {!result.vinculado && !result.ignorado && result.confidence > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">{Math.round(result.confidence * 100)}% confiança</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Nome PDF:</span><div className="font-medium">{result.nome ?? "Não identificado"}</div></div>
            <div><span className="text-muted-foreground">CPF:</span><div className="font-medium">{result.cpf ?? "Não identificado"}</div></div>
            <div><span className="text-muted-foreground">Período:</span><div className="font-medium">{result.mes && result.ano ? `${String(result.mes).padStart(2, "0")}/${result.ano}` : "Não identificado"}</div></div>
            <div><span className="text-muted-foreground">Unidade:</span><div className="font-medium">{result.unidadeId ? unidades.find(u => u.id === result.unidadeId)?.nome : "Não identificada"}</div></div>
          </div>

          {result.matchedProfile && (
            <div className="p-3 bg-white rounded-xl border border-border">
              <div className="text-xs text-muted-foreground mb-1">Colaborador identificado:</div>
              <div className="font-semibold">{result.matchedProfile.nome}</div>
              <div className="text-xs text-muted-foreground">CPF: {result.matchedProfile.cpf}</div>
            </div>
          )}

          {!result.vinculado && !result.ignorado && (
            <div className="space-y-3">
              {result.matchedProfile && (
                <Button className="w-full" onClick={() => handleVincular(result.matchedProfile!.id)} disabled={isUploading}>
                  {isUploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle2 className="size-4 mr-2" />}
                  Vincular a {result.matchedProfile.nome}
                </Button>
              )}

              <div className="space-y-2">
  <Label className="text-xs">Vincular manualmente a outro colaborador:</Label>
  <div className="flex gap-2">
    <Select 
      value={manualProfileId} 
      onValueChange={(value) => {
        setManualProfileId(value);
        setShowNovoColab(false); // <--- Isso força o fechamento do form
      }}
    >
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Selecione o colaborador..." />
      </SelectTrigger>
      <SelectContent>
        {profiles.map(p => (
          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Button 
      variant="outline" 
      onClick={() => {
        setShowNovoColab(false); // <--- Isso força o fechamento do form
        if (manualProfileId) handleVincular(manualProfileId);
      }} 
      disabled={!manualProfileId || isUploading}
    >
      Vincular
    </Button>
  </div>
</div>

              {(showNovoColab && !manualProfileId) ? (
                <div className="space-y-3 p-4 bg-white rounded-xl border border-border">
                  <div className="font-semibold text-sm">Cadastrar Novo Colaborador</div>
                  <div className="grid grid-cols-2 gap-2">
                    
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Nome Completo *</Label>
                      <Input placeholder="Nome completo" value={novoColabForm.nome} onChange={e => setNovoColabForm(f => ({ ...f, nome: e.target.value }))} />
                    </div>
                    
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">CPF *</Label>
                      <Input placeholder="000.000.000-00" value={novoColabForm.cpf} onChange={e => setNovoColabForm(f => ({ ...f, cpf: e.target.value }))} />
                    </div>

                    {result.isNewCargo && !novoColabForm.cargo && result.suggestedCargoName && (
                      <div className="col-span-2 bg-amber-50 border border-amber-200 p-2 rounded-lg text-xs text-amber-800 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                        <span>✨ O cargo <strong>"{result.suggestedCargoName}"</strong> foi lido no PDF mas não bateu com a escrita exata da base.</span>
                        <Button 
                          type="button"
                          size="sm"
                          variant="default"
                          className="bg-amber-600 text-white hover:bg-amber-700 h-7 text-[11px] shrink-0"
                          onClick={() => handleCadastrarCargoRapido(result.suggestedCargoName!)}
                        >
                          + Cadastrar na Base
                        </Button>
                      </div>
                    )}

                    <div className="col-span-2 grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Cargo *</Label>
                        <div className="flex gap-1.5">
                          <Select value={novoColabForm.cargo} onValueChange={(v) => setNovoColabForm(f => ({ ...f, cargo: v }))}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecione o cargo" />
                            </SelectTrigger>
                            <SelectContent>
                              {listaCargos.map((cargoObj) => (
                                <SelectItem key={cargoObj.id} value={cargoObj.id}>{cargoObj.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0 h-10 w-10 border-dashed hover:border-primary hover:text-primary"
                            title="Cadastrar novo cargo na base"
                            onClick={async () => {
                              const nomeNovoCargo = prompt("Digite o nome do novo cargo que deseja cadastrar:");
                              if (nomeNovoCargo && nomeNovoCargo.trim() !== "") {
                                await handleCadastrarCargoRapido(nomeNovoCargo.trim());
                              }
                            }}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Matrícula (Opcional)</Label>
                        <Input value={novoColabForm.matricula} onChange={e => setNovoColabForm(f => ({ ...f, matricula: e.target.value }))} placeholder="Matrícula" />
                      </div>
                    </div>

                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Unidade *</Label>
                      <Select value={novoColabForm.unidadeId} onValueChange={v => setNovoColabForm(f => ({ ...f, unidadeId: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                        <SelectContent>
                          {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Data de Admissão</Label>
                      <Input type="date" value={novoColabForm.dataAdmissao} onChange={e => setNovoColabForm(f => ({ ...f, dataAdmissao: e.target.value }))} />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Data de Nascimento</Label>
                      <Input type="date" value={novoColabForm.dataNascimento} onChange={e => setNovoColabForm(f => ({ ...f, dataNascimento: e.target.value }))} />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Folga Fixa Semanal</Label>
                      <Select value={novoColabForm.folgaFixa} onValueChange={v => setNovoColabForm(f => ({ ...f, folgaFixa: v }))}>
                        <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          <SelectItem value="0">Domingo</SelectItem>
                          <SelectItem value="1">Segunda-feira</SelectItem>
                          <SelectItem value="2">Terça-feira</SelectItem>
                          <SelectItem value="3">Quarta-feira</SelectItem>
                          <SelectItem value="4">Quinta-feira</SelectItem>
                          <SelectItem value="5">Sexta-feira</SelectItem>
                          <SelectItem value="6">Sábado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Perfil de Acesso</Label>
                      <Select value={novoColabForm.perfil_acesso} onValueChange={v => setNovoColabForm(f => ({ ...f, perfil_acesso: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="colaborador">Colaborador</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input placeholder="(00) 00000-0000" value={novoColabForm.whatsapp} onChange={e => setNovoColabForm(f => ({ ...f, whatsapp: e.target.value }))} />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium flex items-center justify-between">
                        <span>Senha Inicial</span>
                        {novoColabForm.cpf && (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Sugerida: {novoColabForm.cpf.replace(/\D/g, "").slice(-6)}
                          </span>
                        )}
                      </Label>
                      <Input 
                        type="text" 
                        placeholder="Padrão: 6 últimos dígitos CPF" 
                        value={novoColabForm.senha} 
                        onChange={e => setNovoColabForm(f => ({ ...f, senha: e.target.value }))} 
                        className="font-mono bg-muted/30"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Informe ao colaborador que a senha padrão são os <strong>6 últimos dígitos do CPF</strong> dele.
                      </p>
                    </div>

                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={handleCriarColab} disabled={isUploading}>
                      {isUploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <UserPlus className="size-4 mr-2" />} Criar Colaborador
                    </Button>
                    <Button variant="outline" onClick={() => setShowNovoColab(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => { 
                    let dataCorreta = "";
                    if (result.dataAdmissao && result.dataAdmissao.includes("/")) {
                      const partes = result.dataAdmissao.split("/");
                      if (partes.length === 3) {
                        dataCorreta = `${partes[2]}-${partes[1]}-${partes[0]}`;
                      }
                    } else {
                      dataCorreta = result.dataAdmissao ?? "";
                    }

                    setShowNovoColab(true); 
                    setNovoColabForm({ 
                      nome: result.nome ?? "", 
                      cpf: result.cpf ?? "", 
                      cargo: result.cargo ?? "", 
                      unidadeId: result.unidadeId ?? "", 
                      senha: result.cpf ? result.cpf.replace(/\D/g, "").slice(-6) : "", 
                      folgaFixa: "none", 
                      dataAdmissao: dataCorreta, 
                      dataNascimento: "", 
                      whatsapp: "", 
                      perfil_acesso: "colaborador",
                      matricula: "" 
                    }); 
                  }}
                >
                  <UserPlus className="size-4 mr-2" /> Cadastrar Novo Colaborador
                </Button>
              )}

              <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleIgnorar}>
                <XCircle className="size-4 mr-2" /> Ignorar esta página
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Todas as páginas</div>
        {pageResults.map((r, i) => (
          <button key={i} onClick={() => setCurrentPage(i)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${i === currentPage ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}>
            <span>Pág. {r.pageNumber} — {r.nome ?? "Nome não identificado"}</span>
            <span>{r.vinculado ? "✅" : r.ignorado ? "⛔" : r.matchStatus === "automatico" ? "🟢" : r.matchStatus === "sugerido" ? "🟡" : "🔴"}</span>
          </button>
        ))}
      </div>

      {vinculados + ignorados === totalPages && (
        <Button className="w-full" onClick={() => { setPageResults([]); setSelectedFile(null); setCurrentPage(0); }}>
          Processar Novo Documento
        </Button>
      )}
    </div>
  );
}