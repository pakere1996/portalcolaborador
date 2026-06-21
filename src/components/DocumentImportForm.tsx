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

// 🔥 EXPORTAR PageResult E ProfileForMatching
export interface PageResult {
  pageNumber: number;
  text: string;
  nome: string | null;
  cnpj: string | null;
  mes: number | null;
  ano: number | null;
  unidadeId: string | null;
  matchStatus: "automatico" | "revisao";
  matchedProfile: ProfileForMatching | null;
  resolvido: boolean;
  ignorado: boolean;
  aprovado: boolean;
  aprovadoEm?: string;
  duplicadoId: string | null;
  acaoSeDuplicado: "substituir" | "manter_antigo" | null;
  matricula?: string | null;
  cargo?: string | null;
  regime_trabalho?: string | null;
}

export interface ProfileForMatching {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
  unidade_id: string | null;
  possui_folha_ponto?: boolean;
  regime_trabalho?: string | null;
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
    const fetchProfiles = async () => {
      let query = supabase
        .from("profiles")
        .select("id, nome, cpf, matricula, unidade_id, possui_folha_ponto, regime_trabalho")
        .eq("ativo", true);
      
      if (documentType === "ponto") {
        query = query.eq("possui_folha_ponto", true);
      }
      
      const { data } = await query.order("nome");
      setProfiles((data ?? []) as ProfileForMatching[]);
    };
    fetchProfiles();

    supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome")
      .then(({ data }) => setUnidades(data ?? []));
    supabase.from("cargos").select("id, nome").order("nome")
      .then(({ data }) => setListaCargos(data ?? []));
  }, [user?.id, documentType]);

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

  const handleProcessar = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const pages = await extractTextFromPDF(selectedFile);
      const resultsComMatch: PageResult[] = pages.map((p) => {
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
          matchStatus: (matchedProfile ? "automatico" : "revisao") as "automatico" | "revisao",
          matchedProfile,
          resolvido: !!matchedProfile,
          ignorado: false,
          aprovado: false,
          duplicadoId: null,
          acaoSeDuplicado: null,
        };
      });

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

  const avancarParaProximaPendente = () => {
    const proximoIndex = pageResults.findIndex((r, i) => i > currentPage && !r.resolvido && !r.ignorado);
    if (proximoIndex !== -1) {
      setCurrentPage(proximoIndex);
    } else {
      const qualquerPendente = pageResults.findIndex((r) => !r.resolvido && !r.ignorado);
      if (qualquerPendente === -1) {
        toast.success("Todas as páginas foram processadas! Clique em 'Aprovar e Salvar' para finalizar.");
      }
    }
  };

  const handleVincular = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    setPageResults(prev => {
      const updated = prev.map((r, i) =>
        i === currentPage
          ? { ...r, resolvido: true, matchedProfile: profile, matchStatus: "automatico" as "automatico" }
          : r
      );
      return updated;
    });

    setShowNovoColab(false);
    setManualProfileId("");
    toast.success(`Página vinculada a ${profile.nome}.`);
    avancarParaProximaPendente();
  };

  const handleIgnorar = () => {
    setConfirmIgnorar(true);
  };

  const confirmarIgnorar = () => {
    setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, ignorado: true, resolvido: true } : r));
    setConfirmIgnorar(false);
    toast.info("Página ignorada.");
    avancarParaProximaPendente();
  };

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
        possui_folha_ponto: documentType === "ponto" ? true : false,
      }).eq("id", authUser.userId);
      if (profErr) throw profErr;

      const newProfile: ProfileForMatching = { 
        id: authUser.userId, 
        nome: novoColabForm.nome, 
        cpf: cleanCpf, 
        matricula: novoColabForm.matricula || null, 
        unidade_id: novoColabForm.unidadeId,
        possui_folha_ponto: documentType === "ponto",
      };
      setProfiles(prev => [...prev, newProfile]);
      setShowNovoColab(false);
      setNovoColabForm({ nome: "", cpf: "", cargo: "", unidadeId: "", senha: "", folgaFixa: "none", dataAdmissao: "", dataNascimento: "", whatsapp: "", perfil_acesso: "colaborador", matricula: "" });
      toast.success("Colaborador criado com sucesso! Vinculando página...");

      setPageResults(prev => prev.map((r, i) => i === currentPage ? { ...r, matchedProfile: newProfile, matchStatus: "automatico" as "automatico", resolvido: true } : r));
      setManualProfileId(newProfile.id);
      avancarParaProximaPendente();
    } catch (err) {
      toast.error("Erro ao criar colaborador", { description: (err as Error).message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDecisaoDuplicata = (acao: "substituir" | "manter_antigo") => {
    setPageResults(prev => prev.map((r, i) =>
      i === currentPage
        ? {
            ...r,
            acaoSeDuplicado: acao,
            resolvido: true,
            ignorado: acao === "manter_antigo",
          }
        : r
    ));
    toast.info(acao === "substituir" ? "Documento será substituído ao aprovar." : "Página ignorada, mantendo o documento antigo.");
    avancarParaProximaPendente();
  };

  const irParaPagina = (index: number) => {
    if (index >= 0 && index < pageResults.length) {
      setCurrentPage(index);
    }
  };

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

        if (result.duplicadoId && result.acaoSeDuplicado === "substituir") {
          await supabase.from("documentos").delete().eq("id", result.duplicadoId);
          substituidos++;
        } else if (result.duplicadoId) {
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
        setPageResults(prev => prev.map(r =>
          r.pageNumber === result.pageNumber
            ? { ...r, aprovado: true, aprovadoEm }
            : r
        ));
      }

      let msg = `${salvos} documento(s) salvo(s) com sucesso!`;
      if (substituidos > 0) msg += ` ${substituidos} substituído(s).`;
      toast.success(msg);

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
  const jaAprovado = pageResults.some(r => r.aprovado);

  const Navegacao = ({ posicao }: { posicao: "topo" | "baixo" }) => (
    <div className={`flex items-center justify-between gap-2 ${posicao === "baixo" ? "mt-4 pt-4 border-t" : "mb-2"}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => irParaPagina(currentPage - 1)}
        disabled={currentPage === 0}
      >
        <ChevronLeft className="size-4 mr-1" /> Anterior
      </Button>
      <span className="text-sm font-medium">
        Página {currentPage + 1} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => irParaPagina(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
      >
        Próximo <ChevronRight className="size-4 ml-1" />
      </Button>
    </div>
  );

  // Renderização (mesma já existente)
  // [código omitido por brevidade – mantém o mesmo JSX]

  // ... o resto do JSX permanece igual
}