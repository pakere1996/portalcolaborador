import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  FileText,
  Eye,
  Download,
  Search,
  ChevronRight,
} from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import { FavoritarBotao } from "@/components/FavoritarBotao";

interface DocumentoUnificado {
  id: string;
  tipo: "contracheque" | "adiantamento" | "ponto" | "atestado" | "disciplinar" | "sindical";
  colaborador_id: string | null;
  colaborador_nome: string;
  colaborador_ativo: boolean | null;
  unidade_id: string | null;
  unidade_nome: string | null;
  mes: number | null;
  ano: number | null;
  data: string;
  status: string;
  observacao: string | null;
  storage_path: string | null;
  nome_pdf: string | null;
  created_at: string;
  dias_afastamento?: number | null;
  observacao_admin?: string | null;
  tipo_disciplinar?: string | null;
  sindicato_patronal?: string;
  sindicato_laboral?: string;
}

interface Profile {
  id: string;
  nome: string;
  unidade_id: string | null;
  ativo: boolean;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Negociacao {
  id: string;
  unidade_id: string;
  sindicato_patronal_id: string;
  sindicato_laboral_id: string;
  ano: number;
  mes: number;
  tipo_documento: "act" | "cct";
  storage_path: string | null;
  nome_pdf: string | null;
  created_at: string;
  sindicato_patronal?: { nome: string };
  sindicato_laboral?: { nome: string };
  unidade?: { nome: string };
}

const MESES = [
  { value: "todos", label: "Todos" },
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const TIPOS_DOCUMENTO = [
  { value: "todos", label: "Todos" },
  { value: "contracheque", label: "Contracheque" },
  { value: "adiantamento", label: "Adiantamento" },
  { value: "ponto", label: "Folha de Ponto" },
  { value: "atestado", label: "Atestado" },
  { value: "disciplinar", label: "Registro Disciplinar" },
  { value: "sindical", label: "ACT/CCT (Sindical)" },
];

const STATUS_OPTS = [
  { value: "todos", label: "Todos" },
  { value: "disponivel", label: "Disponível" },
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "rejeitado", label: "Rejeitado" },
];

export default function DocumentosHistoricoCompleto() {
  const [documentos, setDocumentos] = useState<DocumentoUnificado[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroUnidade, setFiltroUnidade] = useState("todos");
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroAno, setFiltroAno] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [search, setSearch] = useState("");

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentoUnificado | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, unidadesRes] = await Promise.all([
        supabase.from("profiles").select("id, nome, unidade_id, ativo").order("nome"),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (unidadesRes.error) throw unidadesRes.error;

      const profilesData = profilesRes.data ?? [];
      const unidadesData = unidadesRes.data ?? [];
      setProfiles(profilesData);
      setUnidades(unidadesData);

      const profileMap = new Map(profilesData.map(p => [p.id, p]));
      const unidadeMap = new Map(unidadesData.map(u => [u.id, u.nome]));

      // 1. Documentos padrão
      const { data: docsData, error: docsError } = await supabase
        .from("documentos")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (docsError) throw docsError;

      // 2. Atestados
      const { data: atestadosData, error: atestadosError } = await supabase
        .from("atestados")
        .select("*")
        .order("created_at", { ascending: false });

      if (atestadosError) throw atestadosError;

      // 3. Registros disciplinares
      const { data: disciplinaresData, error: disciplinaresError } = await supabase
        .from("registros_disciplinares")
        .select("*")
        .order("created_at", { ascending: false });

      if (disciplinaresError) throw disciplinaresError;

      // 4. Documentos sindicais
      const { data: negociacoesData, error: negociacoesError } = await supabase
        .from("negociacoes")
        .select(`
          *,
          sindicato_patronal:sindicatos!negociacoes_sindicato_patronal_id_fkey(nome),
          sindicato_laboral:sindicatos!negociacoes_sindicato_laboral_id_fkey(nome),
          unidade:unidades(nome)
        `)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });

      if (negociacoesError) throw negociacoesError;

      // Mapear documentos
      const docsMapeados: DocumentoUnificado[] = (docsData ?? []).map((doc) => {
        const profile = profileMap.get(doc.colaborador_id);
        return {
          id: doc.id,
          tipo: doc.tipo as "contracheque" | "adiantamento" | "ponto",
          colaborador_id: doc.colaborador_id,
          colaborador_nome: profile ? `${profile.nome}${!profile.ativo ? ' (Inativo)' : ''}` : "Colaborador removido",
          colaborador_ativo: profile?.ativo ?? null,
          unidade_id: profile?.unidade_id ?? null,
          unidade_nome: profile?.unidade_id ? unidadeMap.get(profile.unidade_id) ?? null : null,
          mes: doc.mes,
          ano: doc.ano,
          data: `${doc.ano}-${String(doc.mes).padStart(2, "0")}-01`,
          status: doc.status || "disponivel",
          observacao: null,
          storage_path: doc.storage_path,
          nome_pdf: doc.nome_pdf,
          created_at: doc.created_at,
          dias_afastamento: null,
          observacao_admin: null,
          tipo_disciplinar: null,
        };
      });

      const atestadosMapeados: DocumentoUnificado[] = (atestadosData ?? []).map((a) => {
        const profile = profileMap.get(a.colaborador_id);
        const dataAtestado = a.data_atestado || a.created_at.split("T")[0];
        const [ano, mes] = dataAtestado.split("-").map(Number);
        return {
          id: a.id,
          tipo: "atestado",
          colaborador_id: a.colaborador_id,
          colaborador_nome: profile ? `${profile.nome}${!profile.ativo ? ' (Inativo)' : ''}` : "Colaborador removido",
          colaborador_ativo: profile?.ativo ?? null,
          unidade_id: profile?.unidade_id ?? null,
          unidade_nome: profile?.unidade_id ? unidadeMap.get(profile.unidade_id) ?? null : null,
          mes: mes,
          ano: ano,
          data: dataAtestado,
          status: a.status || "pendente",
          observacao: a.observacao || null,
          storage_path: a.storage_path || null,
          nome_pdf: a.nome_pdf || null,
          created_at: a.created_at,
          dias_afastamento: a.dias_afastamento || null,
          observacao_admin: a.observacao_admin || null,
          tipo_disciplinar: null,
        };
      });

      const disciplinaresMapeados: DocumentoUnificado[] = (disciplinaresData ?? []).map((d) => {
        const profile = profileMap.get(d.colaborador_id);
        const dataDoc = d.data || d.created_at.split("T")[0];
        const [ano, mes] = dataDoc.split("-").map(Number);
        return {
          id: d.id,
          tipo: "disciplinar",
          colaborador_id: d.colaborador_id,
          colaborador_nome: profile ? `${profile.nome}${!profile.ativo ? ' (Inativo)' : ''}` : "Colaborador removido",
          colaborador_ativo: profile?.ativo ?? null,
          unidade_id: profile?.unidade_id ?? null,
          unidade_nome: profile?.unidade_id ? unidadeMap.get(profile.unidade_id) ?? null : null,
          mes: mes,
          ano: ano,
          data: dataDoc,
          status: d.tipo || "outro",
          observacao: d.observacao || null,
          storage_path: d.storage_path || null,
          nome_pdf: d.nome_pdf || null,
          created_at: d.created_at,
          dias_afastamento: d.dias_afastamento || null,
          observacao_admin: null,
          tipo_disciplinar: d.tipo || "outro",
        };
      });

      const negociacoesMapeadas: DocumentoUnificado[] = (negociacoesData ?? []).map((n: Negociacao) => {
        const unidadeNome = (n.unidade as any)?.nome || "Unidade não definida";
        const patronalNome = (n.sindicato_patronal as any)?.nome || "—";
        const laboralNome = (n.sindicato_laboral as any)?.nome || "—";
        return {
          id: n.id,
          tipo: "sindical",
          colaborador_id: null,
          colaborador_nome: `ACT/CCT - ${unidadeNome}`,
          colaborador_ativo: null,
          unidade_id: n.unidade_id,
          unidade_nome: unidadeNome,
          mes: n.mes,
          ano: n.ano,
          data: `${n.ano}-${String(n.mes).padStart(2, "0")}-01`,
          status: "disponivel",
          observacao: `Patronal: ${patronalNome} | Laboral: ${laboralNome}`,
          storage_path: n.storage_path,
          nome_pdf: n.nome_pdf,
          created_at: n.created_at,
          dias_afastamento: null,
          observacao_admin: null,
          tipo_disciplinar: null,
          sindicato_patronal: patronalNome,
          sindicato_laboral: laboralNome,
        };
      });

      const todos = [...docsMapeados, ...atestadosMapeados, ...disciplinaresMapeados, ...negociacoesMapeadas];
      todos.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setDocumentos(todos);
    } catch (error) {
      console.error("Erro ao carregar histórico completo:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtros
  const filtrados = useMemo(() => {
    return documentos.filter((doc) => {
      if (filtroTipo !== "todos" && doc.tipo !== filtroTipo) return false;
      if (filtroUnidade !== "todos" && doc.unidade_id !== filtroUnidade) return false;
      if (filtroColab !== "todos" && doc.colaborador_id !== filtroColab) return false;
      if (filtroMes !== "todos" && doc.mes !== parseInt(filtroMes)) return false;
      if (filtroAno !== "todos" && doc.ano !== parseInt(filtroAno)) return false;
      if (filtroStatus !== "todos" && doc.status !== filtroStatus) return false;
      if (search) {
        const term = search.toLowerCase();
        const nomeMatch = doc.colaborador_nome.toLowerCase().includes(term);
        const tipoMatch = doc.tipo.toLowerCase().includes(term);
        const statusMatch = doc.status.toLowerCase().includes(term);
        if (!nomeMatch && !tipoMatch && !statusMatch) return false;
      }
      return true;
    });
  }, [documentos, filtroTipo, filtroUnidade, filtroColab, filtroMes, filtroAno, filtroStatus, search]);

  const anos = useMemo(() => {
    const set = new Set<number>();
    documentos.forEach(d => { if (d.ano) set.add(d.ano); });
    return Array.from(set).sort((a, b) => b - a);
  }, [documentos]);

  const getTipoLabel = (tipo: string) => {
    const map: Record<string, string> = {
      contracheque: "Contracheque",
      adiantamento: "Adiantamento",
      ponto: "Folha de Ponto",
      atestado: "Atestado",
      disciplinar: "Registro Disciplinar",
      sindical: "ACT/CCT",
    };
    return map[tipo] || tipo;
  };

  const getStatusBadge = (status: string, tipo: string) => {
    if (tipo === "atestado") {
      if (status === "aprovado") return <Badge className="bg-green-100 text-green-700 border-green-200">Aprovado</Badge>;
      if (status === "rejeitado") return <Badge className="bg-red-100 text-red-700 border-red-200">Rejeitado</Badge>;
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendente</Badge>;
    }
    if (tipo === "disciplinar") {
      const map: Record<string, string> = {
        advertencia: "Advertência",
        suspensao: "Suspensão",
        justa_causa: "Justa Causa",
        outro: "Outro",
      };
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">{map[status] || status}</Badge>;
    }
    if (tipo === "sindical") {
      return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Disponível</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 border-green-200">Disponível</Badge>;
  };

  const handleDownload = async (doc: DocumentoUnificado) => {
    if (!doc.storage_path) {
      toast.warning("Este documento não possui arquivo anexado.");
      return;
    }
    const bucket = doc.tipo === "sindical" ? "sindicatos" : "documentos";
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const handlePreview = async (doc: DocumentoUnificado) => {
    if (!doc.storage_path) {
      toast.warning("Este documento não possui arquivo para visualização.");
      return;
    }
    setSelectedDoc(doc);
    const bucket = doc.tipo === "sindical" ? "sindicatos" : "documentos";
    const { data } = await supabase.storage
      .from(bucket)
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Histórico Completo de Documentos
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os documentos de todos os colaboradores em um único lugar.
          </p>
        </div>
        <FavoritarBotao 
          rota="/admin/documentos/historico" 
          label="Histórico Completo" 
          icone="ListChecks" 
        />
      </div>

      {/* Filtros */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Colaborador</Label>
              <Select value={filtroColab} onValueChange={setFiltroColab}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}{!p.ativo ? ' (Inativo)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {MESES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anos.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, tipo ou status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => {
              setFiltroTipo("todos");
              setFiltroUnidade("todos");
              setFiltroColab("todos");
              setFiltroMes("todos");
              setFiltroAno("todos");
              setFiltroStatus("todos");
              setSearch("");
            }}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo: Desktop (tabela) / Mobile (cards) */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
          Nenhum documento encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Desktop: Tabela */}
          <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Colaborador</th>
                    <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Tipo</th>
                    <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Competência</th>
                    <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Unidade</th>
                    <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                    <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden xl:table-cell">Data</th>
                    <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">
                        {doc.colaborador_nome}
                        {doc.colaborador_ativo === false && (
                          <Badge variant="outline" className="ml-2 text-[9px] bg-red-50 text-red-600 border-red-200">
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant="outline">{getTipoLabel(doc.tipo)}</Badge>
                      </td>
                      <td className="p-4 hidden md:table-cell font-mono">
                        {doc.mes && doc.ano ? `${String(doc.mes).padStart(2, "0")}/${doc.ano}` : "—"}
                      </td>
                      <td className="p-4 hidden lg:table-cell text-muted-foreground">
                        {doc.unidade_nome || "—"}
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(doc.status, doc.tipo)}
                      </td>
                      <td className="p-4 hidden xl:table-cell text-xs text-muted-foreground">
                        {formatBR(new Date(doc.created_at))}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            title="Visualizar"
                            onClick={() => handlePreview(doc)}
                            disabled={!doc.storage_path}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="Baixar"
                            onClick={() => handleDownload(doc)}
                            disabled={!doc.storage_path}
                          >
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-border text-xs text-muted-foreground text-right">
              {filtrados.length} documento(s) encontrado(s)
            </div>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden space-y-4">
            {filtrados.map((doc) => (
              <div
                key={doc.id}
                className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-3">
                  {/* Linha 1: Nome + Status + Badges */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">
                        {doc.colaborador_nome}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getTipoLabel(doc.tipo)}
                        </Badge>
                        {doc.colaborador_ativo === false && (
                          <Badge variant="outline" className="text-[9px] bg-red-50 text-red-600 border-red-200">
                            Inativo
                          </Badge>
                        )}
                        {getStatusBadge(doc.status, doc.tipo)}
                      </div>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground shrink-0 ml-2" />
                  </div>

                  {/* Linha 2: Detalhes em grid */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Competência:</span>
                      <span className="ml-1">
                        {doc.mes && doc.ano ? `${String(doc.mes).padStart(2, "0")}/${doc.ano}` : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Unidade:</span>
                      <span className="ml-1">{doc.unidade_nome || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium text-foreground">Data:</span>
                      <span className="ml-1">{formatBR(new Date(doc.created_at))}</span>
                    </div>
                  </div>

                  {/* Linha 3: Botões sempre visíveis */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => handlePreview(doc)}
                      disabled={!doc.storage_path}
                    >
                      <Eye className="size-4 mr-1" /> Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownload(doc)}
                      disabled={!doc.storage_path}
                    >
                      <Download className="size-4 mr-1" /> Baixar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <div className="text-xs text-muted-foreground text-center py-2">
              {filtrados.length} documento(s) encontrado(s)
            </div>
          </div>
        </>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
            <DialogDescription>
              {selectedDoc
                ? `${getTipoLabel(selectedDoc.tipo)} - ${selectedDoc.colaborador_nome}`
                : "Documento"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[600px] border-0"
                title="Visualização do documento"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando visualização...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button
              onClick={() => {
                if (selectedDoc) handleDownload(selectedDoc);
              }}
              disabled={!selectedDoc?.storage_path}
            >
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}