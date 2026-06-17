"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { ShieldAlert, Plus, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBR } from "@/lib/folga-rules";
import { adminApi } from "@/lib/admin-api";

type Profile = Tables<'profiles'> & { unidade_id: string | null };
type Unidade = Tables<'unidades'>;

// Estendendo o tipo para suportar variações do esquema do banco de dados de forma segura
type Ocorrencia = Tables<'registros_disciplinares'> & {
  colaborador: Pick<Profile, 'nome'> | null;
  unidade: Pick<Unidade, 'nome'> | null;
  data_ocorrencia?: string | null;
  pdf_storage_path?: string | null;
  storage_path?: string | null;
  motivo?: string | null;
  descricao_detalhada?: string | null;
  observacoes_admin?: string | null;
  tipo?: string | null;
};

const TIPOS_DISCIPLINA = [
  { value: "advertencia_verbal", label: "Advertência Verbal" },
  { value: "advertencia_escrita", label: "Advertência Escrita" },
  { value: "suspensao", label: "Suspensão" },
  { value: "outros", label: "Outros" },
];

export default function AdminDisciplinaPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Formulário
  const [unidadeId, setUnidadeId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState("");
  const [tipo, setTipo] = useState(TIPOS_DISCIPLINA[0].value);
  const [motivo, setMotivo] = useState("");
  const [descricaoDetalhada, setDescricaoDetalhada] = useState("");
  const [observacoesAdmin, setObservacoesAdmin] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [
      { data: profs, error: profError }, 
      { data: units, error: unitError },
      { data: ocorrenciasData, error: ocorrenciasError }
    ] = await Promise.all([
      supabase.from("profiles").select("id, nome, unidade_id").eq("ativo", true).order("nome"),
      supabase.from("unidades").select("id, nome").order("nome"),
      supabase.from("registros_disciplinares")
        .select(`
          *,
          colaborador:colaborador_id(nome),
          unidade:unidade_id(nome)
        `)
        .order("data_ocorrencia", { ascending: false }),
    ]);

    if (profError) toast.error("Erro ao carregar colaboradores", { description: profError.message });
    if (unitError) toast.error("Erro ao carregar unidades", { description: unitError.message });
    if (ocorrenciasError) toast.error("Erro ao carregar ocorrências", { description: ocorrenciasError.message });

    setProfiles((profs ?? []) as Profile[]);
    setUnidades((units ?? []) as Unidade[]);
    setOcorrencias((ocorrenciasData ?? []) as Ocorrencia[]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProfiles = useMemo(() => {
    if (!unidadeId) return [];
    return profiles.filter(p => p.unidade_id === unidadeId);
  }, [profiles, unidadeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidadeId || !colaboradorId || !dataOcorrencia || !tipo || !motivo) {
      return toast.error("Preencha todos os campos obrigatórios (Unidade, Colaborador, Data, Tipo e Motivo)");
    }

    setBusy(true);
    try {
      // 1. Inserir a ocorrência usando asserção de tipo parcial se o Supabase chiar
      const { data: newOcorrencia, error: insertError } = await supabase
        .from("registros_disciplinares")
        .insert({
          colaborador_id: colaboradorId,
          unidade_id: unidadeId,
          data_ocorrencia: dataOcorrencia,
          tipo: tipo,
          motivo: motivo.trim(),
          descricao_detalhada: descricaoDetalhada.trim() || null,
          observacoes_admin: observacoesAdmin.trim() || null,
          responsavel_id: user?.id,
        } as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      const ocorrenciaId = newOcorrencia.id;

      // 2. Chamar a função para gerar o PDF
      toast.info("Gerando PDF da ocorrência em segundo plano...");
      
      adminApi.generateDisciplinaryPdf(ocorrenciaId)
        .then(() => {
          toast.success("PDF da ocorrência gerado e salvo.");
          loadData();
        })
        .catch((e) => {
          toast.error("Erro ao gerar PDF", { description: (e as Error).message });
          loadData();
        });

      toast.success("Ocorrência disciplinar registrada com sucesso.");
      
      // Resetar formulário
      setUnidadeId("");
      setColaboradorId("");
      setDataOcorrencia("");
      setTipo(TIPOS_DISCIPLINA[0].value);
      setMotivo("");
      setDescricaoDetalhada("");
      setObservacoesAdmin("");

      loadData();
    } catch (error) {
      toast.error("Erro ao registrar ocorrência", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const getTipoLabel = (value: string) => {
    return TIPOS_DISCIPLINA.find(t => t.value === value)?.label || value;
  };

  const downloadPdf = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
      if (error) throw error;

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = path.split('/').pop() || 'ocorrencia.pdf';
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Erro ao baixar PDF. O arquivo pode ainda não ter sido gerado.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" /> Módulo de Disciplina
        </h1>
        <p className="text-muted-foreground mt-1">
          Registro de advertências, suspensões e outras ocorrências disciplinares.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Plus className="size-4 text-primary" /> Nova Ocorrência
            </h2>
            <p className="text-sm text-muted-foreground mt-1">O PDF será gerado automaticamente após o registro.</p>
          </div>

          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={unidadeId} onValueChange={(value) => { setUnidadeId(value); setColaboradorId(""); }}>
              <SelectTrigger><SelectValue placeholder="Escolha a unidade" /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select 
              value={colaboradorId} 
              onValueChange={setColaboradorId} 
              disabled={!unidadeId || filteredProfiles.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
              <SelectContent>
                {filteredProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {!unidadeId && <p className="text-xs text-red-500">Selecione uma unidade primeiro.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data da Ocorrência</Label>
              <Input type="date" value={dataOcorrencia} onChange={(e) => setDataOcorrencia(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Disciplina</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DISCIPLINA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo (Resumo)</Label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Atraso recorrente" required />
          </div>

          <div className="space-y-2">
            <Label>Descrição Detalhada</Label>
            <Textarea rows={4} value={descricaoDetalhada} onChange={(e) => setDescricaoDetalhada(e.target.value)} placeholder="Detalhes completos da ocorrência..." />
          </div>

          <div className="space-y-2">
            <Label>Observações (Internas)</Label>
            <Textarea rows={2} value={observacoesAdmin} onChange={(e) => setObservacoesAdmin(e.target.value)} placeholder="Notas internas do RH/Admin..." />
          </div>

          <Button className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Registrando...</> : "Registrar e Gerar Documento"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Histórico de Ocorrências</h2>
            <Badge variant="outline">{ocorrencias.length}</Badge>
          </div>

          ={loading ? (
            <div className="flex items-center justify-center rounded-2xl border p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : ocorrencias.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhuma ocorrência disciplinar registrada.
            </div>
          ) : (
            <div className="grid gap-4">
              {ocorrencias.map((r) => {
                const documentoPath = r.storage_path || r.pdf_storage_path;
                const tipoOcorrencia = r.tipo ?? "outros";

                return (
                  <div key={r.id} className="rounded-2xl border bg-card p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{r.colaborador?.nome ?? "Colaborador Desconhecido"}</div>
                        <div className="text-sm text-muted-foreground">
                          {getTipoLabel(tipoOcorrencia)} em {r.data_ocorrencia ? formatBR(new Date(r.data_ocorrencia + "T00:00:00")) : "Data não informada"}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Badge variant="secondary">{r.unidade?.nome ?? "Sem Unidade"}</Badge>
                        {documentoPath ? (
                          <Button variant="outline" size="sm" onClick={() => downloadPdf(documentoPath)}>
                            <FileText className="size-4 mr-1" /> PDF
                          </Button>
                        ) : (
                          <Badge variant="destructive">PDF Pendente</Badge>
                        )}
                      </div>
                    </div>

                    <div className="text-sm">
                      <span className="font-semibold">Motivo:</span> {r.motivo ?? "Não informado"}
                    </div>
                    
                    {r.descricao_detalhada && (
                      <div className="rounded-xl bg-muted/40 p-3 text-sm">
                        <span className="font-semibold">Detalhes:</span> {r.descricao_detalhada}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}