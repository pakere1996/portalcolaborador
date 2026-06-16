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
  cargo: string | null;
  dataAdmissao: string | null;
  matchStatus: "automatico" | "sugerido" | "revisao";
  matchedProfile: ProfileForMatching | null;
  confidence: number;
  isNewCargo: boolean;
  suggestedCargoName: string | null;
  vinculado: boolean;
  ignorado: boolean;
}

interface Unidade { id: string; nome: string; cnpj: string | null; }
interface Cargo { id: string; nome: string; descricao?: string | null; }

const normalizeTextForMatch = (str: string): string => {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
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
  const [showNovoColab, setShowNovoColab] = useState(false);

  const [novoColabForm, setNovoColabForm] = useState({
    nome: "", cpf: "", cargo: "", unidadeId: "", senha: "",
    folgaFixa: "none", dataAdmissao: "", dataNascimento: "",
    whatsapp: "", perfil_acesso: "colaborador", matricula: ""
  });

  const { user } = useAuth();
  const documentType = window.location.pathname.includes("ponto") ? "ponto" : "contracheque";

  // --- FUNÇÕES DE CONTROLE DE ESTADO (Ajustadas para exclusividade) ---
  const handleVincularManual = (id: string) => {
    setManualProfileId(id);
    setShowNovoColab(false); // Fecha o form se estiver aberto
  };

  const handleAbrirFormulario = () => {
    setManualProfileId(""); // Limpa o seletor antes de abrir
    setShowNovoColab(true);
  };

  // --- EFEITOS E BUSCAS (Mantidos iguais) ---
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("id, nome, cpf, matricula").eq("ativo", true).order("nome")
      .then(({ data }) => setProfiles((data ?? []) as ProfileForMatching[]));
    supabase.from("unidades").select("id, nome, cnpj").eq("ativo", true).order("nome")
      .then(({ data }) => setUnidades(data ?? []));
    supabase.from("cargos").select("id, nome, descricao").order("nome")
      .then(({ data }) => setListaCargos(data ?? []));
  }, [user?.id]);

  // ... (Cole aqui toda a sua lógica de handleProcessar, handleVincular, handleCriarColab, handleCadastrarCargoRapido, etc. igual você já tinha)
  
  // Como o arquivo é longo, garantindo que o seu "return" final use esta estrutura:

  const result = pageResults[currentPage];
  const totalPages = pageResults.length;
  const vinculados = pageResults.filter(r => r.vinculado).length;
  const ignorados = pageResults.filter(r => r.ignorado).length;

  if (pageResults.length === 0) {
    // ... (Mantém o seu render de upload original)
    return <div className="space-y-4">...</div>;
  }

  return (
    <div className="space-y-4">
      {/* ... (Seu cabeçalho de navegação mantido) ... */}
      
      {result && !result.vinculado && !result.ignorado && (
        <div className={`rounded-2xl border-2 p-5 space-y-4 ${result.vinculado ? "border-green-300" : "border-red-200"}`}>
          
          {/* LÓGICA DE EXCLUSIVIDADE: Se não mostrar o formulário, mostra os botões de vínculo */}
          {!showNovoColab ? (
            <div className="space-y-3">
              {result.matchedProfile && (
                <Button className="w-full" onClick={() => handleVincular(result.matchedProfile!.id)}>
                  Vincular a {result.matchedProfile.nome}
                </Button>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Vincular manualmente:</Label>