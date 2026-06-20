import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, X, Loader2, CheckCircle2, AlertTriangle, XCircle, ChevronLeft, ChevronRight, UserPlus, ZoomIn, ZoomOut } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { extractTextFromPDF, renderPdfPageAsImage } from "@/lib/pdf-utils";
import { adminApi } from "@/lib/admin-api";

interface ProfileForMatching {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
}

interface Cargo {
  id: string;
  nome: string;
}

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
}

interface PageResult {
  pageNumber: number;
  text: string;
  nome: string | null;
  cnpj: string | null;
  mes: number | null;
  ano: number | null;
  unidadeId: string | null;
  matchStatus: "automatico" | "revisao";
  matchedProfile: ProfileForMatching | null;
  resolvido: boolean; // true quando vinculado (pendente de aprovação final) ou ignorado
  ignorado: boolean;
  aprovado: boolean; // true só depois do "Aprovar e Salvar"
  aprovadoEm?: string; // data/hora da aprovação
  duplicadoId: string | null; // id do documento existente, se já houver essa competência para o colaborador
  acaoSeDuplicado: "substituir" | "manter_antigo" | null;
}

// Remove acentos e normaliza para comparação exata de nomes
const normalizeNome = (str: string): string => {
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
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
  const [isApproving, setIsApproving] = useState(false);
  const [manualProfileId, setManualProfileId] = useState<string>("");
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [loadingPageImage, setLoadingPageImage] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [novoColabForm, setNovoColabForm] = useState({
    nome: "", cpf: "", cargo: "", unidadeId: "", senha: "",
    folgaFixa: "none", dataAdmissao: "", dataNascimento: "",
    whatsapp: "", perfil_acesso: "colaborador", matricula: "",
  });
  const [showNovoColab, setShowNovoColab] = useState(false);
  const [confirmIgnorar, setConfirmIgnorar] = useState(false);
  const [avisoPendentes, setAvisoPendentes] = useState(false);
  const { user } = useAuth();

  const documentType = window.location.pathname.includes("ponto") ? "ponto" : "contracheque";

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id, nome, cpf, matricula").eq("ativo", true).order("nome")
      .then(({ data }) => setProfiles((data ?? []) as ProfileForMatching[]));
    supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome")
      .then(({ data }) => setUnidades(data ?? []));
    supabase.from("cargos").select("id, nome").order("nome")
      .then(({ data }) => setListaCargos(data ?? []));
  }, [user?.id]);

  useEffect(() => {
    setShowNovoColab(false);
    setManualProfileId("");
    setPageImageUrl(null);
    setZoomLevel(1);

    if (selectedFile && pageResults.length > 0) {
      const pageNum = pageResults[currentPage]?.pageNumber;
      if (pageNum) {
        setLoadingPageImage(true);
        renderPdfPageAsImage(selectedFile, pageNum)
          .then(setPageImageUrl)
          .catch(() => setPageImageUrl(null))
          .finally(() => setLoadingPageImage(false));
      }
    }
  }, [currentPage, selectedFile, pageResults.length]);

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

  // Varre o texto inteiro do PDF procurando o nome exato de algum colaborador cadastrado.
  const findExactMatchInText = (text: string, profilesList: ProfileForMatching[]): { profile: ProfileForMatching | null; nomeEncontrado: string | null } => {
    const textoNormalizado = ` ${normalizeNome(text)} `;

    const matches = profilesList.filter(p => {
      const nomeNormalizado = normalizeNome(p.nome);
      return textoNormalizado.includes(` ${nomeNormalizado} `) ||
             textoNormalizado.startsWith(`${nomeNormalizado} `) ||
             textoNormalizado.endsWith(` ${nomeNormalizado}`) ||
             textoNormalizado === nomeNormalizado;
    });

    if (matches.length === 1) {
      return { profile: matches[0], nomeEncontrado: matches[0].nome };
    }
    return { profile: null, nomeEncontrado: null };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPageResults([]);
    setCurrentPage(0);
  };

  // Apenas analisa o PDF e monta os resultados — NÃO faz upload nem grava no banco ainda.
  const handleProcessar = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const pages = await extractTextFromPDF(selectedFile);
      const resultsComMatch = pages.map((p) => {
        const text = p.text;

        const { profile: matchedProfile, nomeEncontrado: nome } = findExactMatchInText(text, profiles);

        const cnpjMatch = text.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
        const cnpj = cnpjMatch ? cnpjMatch[0] : null;
        const unidade = cnpj ? unidades.find(u => u.cnpj && cleanCNPJ(u.cnpj) === cleanCNPJ(cnpj)) : null;
        const periodo = extractPeriodo(text);

        return {
          pageNumber: p.pageNumber,
          text,
          nome,
          cnpj,
          mes: periodo?.mes ?? null,
          ano: periodo?.ano ?? null,
          unidadeId: unidade?.id ?? null,
          matchStatus: matchedProfile ? "automatico" : "revisao",
          matchedProfile,
          resolvido: !!matchedProfile,
          ignorado: false,
          aprovado: false,
          duplicadoId: null,
          acaoSeDuplicado: null,
        } as PageResult;
      });

      // Verifica duplicatas: para cada página com colaborador + mês/ano identificados,
      // checa se já existe um documento dessa competência para esse colaborador.
      const results: PageResult[] = await Promise.all(
        resultsComMatch.map(async (r) => {
          if (!r.matchedProfile || !r.mes || !r.ano) return r;

          const { data: existente } = await supabase
            .from("documentos")
            .select("id")
            .eq("colaborador_id", r.matchedProfile.id)
            .eq("tipo", documentType)
            .eq("mes", r.mes)
            .eq("ano", r.ano)
            .maybeSingle();

          if (existente) {
            return { ...r, duplicadoId: existente.id, resolvido: false };
          }
          return r;
        })
      );

      setPageResults(results);
      setCurrentPage(0);

      const qtdAuto = results.filter(r => r.matchedProfile && !r.duplicadoId).length;
      const qtdDuplicados = results.filter(r => r.duplicadoId).length;
      let msg = `${pages.length} páginas processadas (${qtdAuto} com colaborador identificado)`;
      if (qtdDuplicados > 0) msg += `. ${qtdDuplicados} já existem no histórico — revise antes de aprovar.`;
      toast.success(msg);
    } catch (err) {
      toast.error("Erro ao processar PDF", { description: (err as Error).message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Apenas marca a página como "resolvida" (vinculada a um colaborador). Não salva no banco ainda.
  const handleVincular = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    setPageResults(prev => {
      const updated = prev.map((r, i) =>
        i === currentPage
          ? { ...r, resolvido: true, matchedProfile: profile, matchStatus: "automatico" }
          : r
      );
      const nextIndex = updated.findIndex((r, i) => i > currentPage && !r.resolvido && !r.ignorado);
      if (nextIndex !== -1) {
        setTimeout(() => setCurrentPage(nextIndex), 150);
      }
      return updated;
    });

    setShowNovoColab(false);
    setManualProfileId("");
    toast.success(`Página vinculada a ${profile.nome}. Próxima página pendente...`);
  };

  const handleIgnorar = () => {
    setConfirmIgnorar(true);
  };

  const confirmarIgnorar = () => {
    setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, ignorado: true, resolvido: true } : r));
    setConfirmIgnorar(false);
    const next = pageResults.findIndex((r, i) => i > currentPage && !r.resolvido && !r.ignorado);
if (next !== -1) {
  setTimeout(() => setCurrentPage(next), 150);
}

  const handleCriarColab = async () => {
    if (!novoColabForm.nome || !novoColabForm.cpf || !novoColabForm.cargo || !novoColabForm.unidadeId) {
      toast.error("Nome, CPF, cargo e unidade são obrigatórios.");
      return;
    }
    setIsUploading(true);
    try {
      const cleanCpf = novoColabForm.cpf.replace(/\D/g, "");
      const cargoSelecionado = listaCargos.find(c => c.id === novoColabForm.cargo);
      const authUser = await adminApi.createUser({
        nome: novoColabForm.nome.trim(),
        cpf: cleanCpf,
        email: `${cleanCpf}@pakere.com.br`,
        senha: novoColabForm.senha || cleanCpf.slice(-6),
        cargo: cargoSelecionado?.nome ?? novoColabForm.cargo,
        dataAdmissao: novoColabForm.dataAdmissao || null,
        dataNascimento: novoColabForm.dataNascimento || null,
        folgaFixaSemana: novoColabForm.folgaFixa === "none" ? null : Number(novoColabForm.folgaFixa),
        role: novoColabForm.perfil_acesso,
      });

      const { error: profErr } = await supabase.from("profiles").update({
        unidade_id: novoColabForm.unidadeId,
        whatsapp: novoColabForm.whatsapp || null,
        matricula: novoColabForm.matricula || null,
      }).eq("id", authUser.userId);
      if (profErr) throw profErr;

      const newProfile: ProfileForMatching = { id: authUser.userId, nome: novoColabForm.nome, cpf: cleanCpf, matricula: novoColabForm.matricula || null };
      setProfiles(prev => [...prev, newProfile]);
      setShowNovoColab(false);
      setNovoColabForm({ nome: "", cpf: "", cargo: "", unidadeId: "", senha: "", folgaFixa: "none", dataAdmissao: "", dataNascimento: "", whatsapp: "", perfil_acesso: "colaborador", matricula: "" });
      toast.success("Colaborador criado com sucesso! Agora vincule esta página a ele.");

      // Vincula automaticamente a página atual ao colaborador recém-criado
      setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, matchedProfile: newProfile, matchStatus: "automatico", resolvido: true } : r));
      setManualProfileId(newProfile.id);
    } catch (err) {
      toast.error("Erro ao criar colaborador", { description: (err as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  // Só aqui de fato faz upload e grava no banco — depois que TODAS as páginas foram resolvidas.
  const handleAprovarTudo = async () => {
    const pendentes = pageResults.filter(r => !r.resolvido && !r.ignorado);
    if (pendentes.length > 0) {
      setAvisoPendentes(true);
      return;
    }

    setIsApproving(true);
    try {
      const aprovadoEm = new Date().toISOString();
      let salvos = 0;
      let substituidos = 0;

      for (const result of pageResults) {
        if (result.ignorado || !result.matchedProfile || !result.mes || !result.ano) continue;

        // Se for substituição de duplicata, remove o documento antigo primeiro
        if (result.duplicadoId && result.acaoSeDuplicado === "substituir") {
  // Verifica se o documento antigo é do mesmo tipo
  const { data: docAntigo } = await supabase
    .from("documentos")
    .select("tipo")
    .eq("id", result.duplicadoId)
    .single();
  
  if (docAntigo?.tipo !== documentType) {
    toast.error(`Erro: Conflito - documento existente é do tipo ${docAntigo?.tipo}, não ${documentType}`);
    continue;
  }
  
  await supabase.from("documentos").delete().eq("id", result.duplicadoId);
  substituidos++;
        } else if (result.duplicadoId) {
          // Duplicata sem decisão de substituir (não deveria chegar aqui, mas por segurança pula)
          continue;
        }

        const storagePath = `documentos/${documentType}/${result.matchedProfile.id}/${result.ano}_${String(result.mes).padStart(2, "0")}_p${result.pageNumber}_${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from("documentos")
          .upload(storagePath, selectedFile!, { contentType: "application/pdf", upsert: true });
        if (uploadError && !uploadError.message.includes("already exists")) throw uploadError;

        const { error: insertError } = await supabase.from("documentos").insert({
          colaborador_id: result.matchedProfile.id,
          tipo: documentType,
          mes: result.mes,
          ano: result.ano,
          storage_path: storagePath,
          status: "disponivel",
          nome_pdf: selectedFile!.name,
          unidade_id: result.unidadeId,
          aprovado_em: aprovadoEm,
        });
        if (insertError) throw insertError;

        salvos++;
        // Marca a página como aprovada
setPageResults(prev => prev.map(r => 
  r.pageNumber === result.pageNumber 
    ? { ...r, aprovado: true, aprovadoEm } 
    : r
));
      }

      let msg = `${salvos} documento(s) salvo(s) com sucesso!`;
      if (substituidos > 0) msg += ` ${substituidos} substituído(s).`;
      toast.success(msg);

      // Reseta a tela após 2 segundos
setTimeout(() => {
  setPageResults([]);
  setSelectedFile(null);
  setCurrentPage(0);
}, 2000);
    } catch (err) {
      toast.error("Erro ao salvar documentos", { description: (err as Error).message });
    } finally {
      setIsApproving(false);
    }
  };

  const result = pageResults[currentPage];
  const totalPages = pageResults.length;
  const resolvidos = pageResults.filter(r => r.resolvido).length;
  const ignorados = pageResults.filter(r => r.ignorado).length;
  const todasResolvidas = totalPages > 0 && resolvidos === totalPages;
  const jaAprovado = pageResults.some(r => r.aprovado);

  if (pageResults.length === 0) {
    return (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragging ? "border-primary bg-muted/50" : "border-border hover:bg-muted/30"}`}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setSelectedFile(f); }}
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
        <span className="text-muted-foreground">{resolvidos - ignorados} vinculados · {ignorados} ignorados · {totalPages - resolvidos} pendentes</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(resolvidos / totalPages) * 100}%` }} />
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
        <div className={`rounded-2xl border-2 p-5 space-y-4 ${result.ignorado ? "border-gray-200 bg-gray-50 opacity-60" : result.duplicadoId && !result.acaoSeDuplicado ? "border-amber-300 bg-amber-50/50" : result.resolvido ? "border-green-300 bg-green-50" : "border-red-200 bg-red-50/50"}`}>

          <div className="flex items-center gap-2">
            {result.ignorado ? <XCircle className="size-5 text-gray-400" /> : result.duplicadoId && !result.acaoSeDuplicado ? <AlertTriangle className="size-5 text-amber-500" /> : result.resolvido ? <CheckCircle2 className="size-5 text-green-600" /> : <XCircle className="size-5 text-red-500" />}
            <span className="font-semibold text-sm">
              {result.ignorado ? "⛔ Ignorado" : result.duplicadoId && !result.acaoSeDuplicado ? "⚠️ Competência duplicada — decida abaixo" : result.resolvido && result.matchStatus === "automatico" ? "✅ Vinculado automaticamente (nome exato)" : result.resolvido ? "✅ Vinculado (pendente de aprovação final)" : "❌ Revisão manual necessária"}
            </span>
          </div>

          {/* Visualização da página com zoom */}
          <div className="space-y-2">
            {(loadingPageImage || pageImageUrl) && (
              <div className="flex items-center justify-end gap-1">
                <Button variant="outline" size="icon" className="size-7" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
                  <ZoomOut className="size-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <Button variant="outline" size="icon" className="size-7" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>
                  <ZoomIn className="size-3.5" />
                </Button>
              </div>
            )}
            {loadingPageImage ? (
              <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 p-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : pageImageUrl ? (
              <div className="rounded-xl border border-border overflow-auto bg-white max-h-[80vh]">
                <img
                  src={pageImageUrl}
                  alt={`Página ${result.pageNumber}`}
                  style={{ width: `${zoomLevel * 100}%`, minWidth: `${zoomLevel * 100}%`, height: "auto", display: "block" }}
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Nome PDF:</span><div className="font-medium">{result.nome ?? "Não identificado"}</div></div>
            <div><span className="text-muted-foreground">Período:</span><div className="font-medium">{result.mes && result.ano ? `${String(result.mes).padStart(2, "0")}/${result.ano}` : "Não identificado"}</div></div>
            <div className="col-span-2"><span className="text-muted-foreground">Unidade:</span><div className="font-medium">{result.unidadeId ? unidades.find(u => u.id === result.unidadeId)?.nome : "Não identificada"}</div></div>
          </div>

          {result.matchedProfile && (
            <div className="p-3 bg-white rounded-xl border border-border">
              <div className="text-xs text-muted-foreground mb-1">Colaborador identificado:</div>
              <div className="font-semibold">{result.matchedProfile.nome}</div>
              <div className="text-xs text-muted-foreground">CPF: {result.matchedProfile.cpf}</div>
            </div>
          )}

          {result.duplicadoId && !result.ignorado && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="size-5" />
                <span className="font-semibold text-sm">
                  Já existe um documento de {String(result.mes).padStart(2, "0")}/{result.ano} para {result.matchedProfile?.nome} no histórico.
                </span>
              </div>
              <p className="text-xs text-amber-700">Escolha o que fazer com esta página:</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, acaoSeDuplicado: "substituir", resolvido: true } : r))}
                  variant={result.acaoSeDuplicado === "substituir" ? "default" : "outline"}
                >
                  Substituir documento existente
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, acaoSeDuplicado: "manter_antigo", resolvido: true, ignorado: true } : r))}
                >
                  Manter o antigo (ignorar esta página)
                </Button>
              </div>
              {result.acaoSeDuplicado === "substituir" && (
                <p className="text-xs text-amber-700 font-medium">✓ Esta página vai substituir o documento existente ao aprovar.</p>
              )}
            </div>
          )}

          {!result.resolvido && !result.ignorado && !result.duplicadoId && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Vincular manualmente a outro colaborador:</Label>
                <div className="flex gap-2">
                  <Select
                    value={manualProfileId}
                    onValueChange={(value) => { setManualProfileId(value); setShowNovoColab(false); }}
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
                    onClick={() => { setShowNovoColab(false); if (manualProfileId) handleVincular(manualProfileId); }}
                    disabled={!manualProfileId}
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
                    <div className="space-y-1">
                      <Label className="text-xs">Cargo *</Label>
                      <Select value={novoColabForm.cargo} onValueChange={(v) => setNovoColabForm(f => ({ ...f, cargo: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                        <SelectContent>
                          {listaCargos.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Matrícula (Opcional)</Label>
                      <Input value={novoColabForm.matricula} onChange={e => setNovoColabForm(f => ({ ...f, matricula: e.target.value }))} placeholder="Matrícula" />
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
                    setManualProfileId("");
                    setShowNovoColab(true);
                    setNovoColabForm({
                      nome: result.nome ?? "",
                      cpf: "",
                      cargo: "",
                      unidadeId: result.unidadeId ?? "",
                      senha: "",
                      folgaFixa: "none",
                      dataAdmissao: "",
                      dataNascimento: "",
                      whatsapp: "",
                      perfil_acesso: "colaborador",
                      matricula: "",
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

          {result.resolvido && !result.ignorado && !result.duplicadoId && (
            <Button
              variant="outline"
              className="w-full text-muted-foreground"
              onClick={() => setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, resolvido: false } : r))}
            >
              Desfazer vínculo (revisar novamente)
            </Button>
          )}

          {result.duplicadoId && result.acaoSeDuplicado && (
            <Button
              variant="outline"
              className="w-full text-muted-foreground"
              onClick={() => setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, acaoSeDuplicado: null, resolvido: false, ignorado: false } : r))}
            >
              Desfazer decisão sobre duplicata
            </Button>
          )}
        </div>
      )}

      <div className="space-y-1">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Todas as páginas</div>
        {pageResults.map((r, i) => (
          <button key={i} onClick={() => setCurrentPage(i)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${i === currentPage ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}>
            <span>Pág. {r.pageNumber} — {r.matchedProfile?.nome ?? r.nome ?? "Nome não identificado"}</span>
            <span>{r.ignorado ? "⛔" : r.duplicadoId && !r.acaoSeDuplicado ? "⚠️" : r.resolvido ? "✅" : "🔴"}</span>
          </button>
        ))}
      </div>

      {!jaAprovado && (
        <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={handleAprovarTudo} disabled={isApproving}>
          {isApproving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Salvando documentos...</> : <><CheckCircle2 className="size-4 mr-2" /> Aprovar e Salvar Documentos</>}
        </Button>
      )}

      <AlertDialog open={confirmIgnorar} onOpenChange={setConfirmIgnorar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorar esta página?</AlertDialogTitle>
            <AlertDialogDescription>
              A página {result?.pageNumber} não será vinculada a nenhum colaborador e não fará parte do documento salvo. Você pode reverter depois clicando em "Desfazer".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarIgnorar} className="bg-destructive text-white hover:bg-destructive/90">
              Ignorar Página
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={avisoPendentes} onOpenChange={setAvisoPendentes}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Existem páginas pendentes</AlertDialogTitle>
            <AlertDialogDescription>
              Ainda há {pageResults.filter(r => !r.resolvido && !r.ignorado).length} página(s) sem colaborador vinculado. Vincule manualmente, cadastre o colaborador ou ignore essas páginas antes de aprovar o documento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setAvisoPendentes(false);
              const primeiraPendente = pageResults.findIndex(r => !r.resolvido && !r.ignorado);
              if (primeiraPendente !== -1) setCurrentPage(primeiraPendente);
            }}>
              Ver Páginas Pendentes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
