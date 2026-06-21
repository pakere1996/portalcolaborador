"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { notifyAtestadoPendente } from "@/lib/notify-atestado";
import {
  atestadoStoragePath,
  getFileKind,
  formatAtestadoStatus,
  newDocumentId,
  statusClass,
} from "@/lib/documentos-regulatorios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FileText, Upload, AlertTriangle, Loader2, CalendarDays, UserCheck, Eye, Download, Filter } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface Atestado {
  id: string;
  colaborador_id: string;
  data_atestado: string;
  dias_afastamento: number;
  observacao: string | null;
  observacao_admin: string | null;
  status: string;
  storage_path: string;
  storage_type: string;
  created_at: string;
  respondido_em: string | null;
  criado_por: string | null;
}

interface PendingUpload {
  data: string;
  dias: string;
  observacao: string;
  file: File;
}

export default function DocumentosAtestadosPage() {
  const { user, profile } = useAuth();
  const [atestados, setAtestados] = useState<Atestado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState("");
  const [dias, setDias] = useState("");
  const [observacao, setObservacao] = useState("");
  const [duplicate, setDuplicate] = useState<Atestado | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);

  // Filtros
  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedAtestado, setSelectedAtestado] = useState<Atestado | null>(null);

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("atestados")
        .select("*")
        .eq("colaborador_id", user.id);

      if (filtroAno !== "todos") {
        query = query.eq("ano", parseInt(filtroAno));
      }
      if (filtroMes !== "todos") {
        query = query.eq("mes", parseInt(filtroMes));
      }

      const { data: items, error } = await query
        .order("data_atestado", { ascending: false });

      if (error) throw error;
      setAtestados(items ?? []);
    } catch (error) {
      toast.error("Erro ao carregar atestados", { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user, filtroAno, filtroMes]);

  useEffect(() => {
    const checkDuplicate = async () => {
      if (!user || !data) {
        setDuplicate(null);
        return;
      }

      const { data: existing } = await supabase
        .from("atestados")
        .select("*")
        .eq("colaborador_id", user.id)
        .eq("data_atestado", data)
        .maybeSingle();

      setDuplicate((existing as Atestado | null) ?? null);
    };

    checkDuplicate();
  }, [data, user]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }

    const kind = getFileKind(selected);
    if (!kind) {
      toast.error("Arquivo inválido", { description: "Envie apenas PDF, JPG ou PNG." });
      setFile(null);
      return;
    }

    setFile(selected);
  };

  // Calcula data de retorno
  const calcularDataRetorno = (dataAtestado: string, dias: number) => {
    if (!dataAtestado || !dias || dias <= 0) return null;
    const dt = new Date(dataAtestado + "T00:00:00");
    dt.setDate(dt.getDate() + dias);
    return formatBR(dt);
  };

  const uploadAtestado = async (payload: PendingUpload) => {
    if (!user || !profile) return;

    setBusy(true);
    try {
      const id = newDocumentId();
      const storagePath = atestadoStoragePath(user.id, payload.data, id, payload.file);
      const kind = getFileKind(payload.file);

      if (!kind) throw new Error("Tipo de arquivo não suportado.");

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, payload.file, {
          contentType: payload.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: inserted, error: insertError } = await supabase
        .from("atestados")
        .insert({
          colaborador_id: user.id,
          data_atestado: payload.data,
          dias_afastamento: Number(payload.dias),
          observacao: payload.observacao.trim() || null,
          observacao_admin: null,
          status: "pendente",
          storage_path: storagePath,
          storage_type: kind,
          criado_por: user.id,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      try {
        await notifyAtestadoPendente(inserted.id, profile.nome);
      } catch (notifyError) {
        toast.warning("Atestado enviado, mas a notificação dos admins falhou", {
          description: (notifyError as Error).message,
        });
      }

      toast.success("Atestado enviado para aprovação");
      setFile(null);
      setData("");
      setDias("");
      setObservacao("");
      setDuplicate(null);
      load();
    } catch (error) {
      toast.error("Erro ao enviar atestado", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!file || !data || !dias) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // 🔥 Validação: data não pode ser maior que hoje
    if (data > hojeStr) {
      toast.error("A data do atestado não pode ser futura.");
      return;
    }

    const payload = { data, dias, observacao, file };
    if (duplicate) {
      setPendingUpload(payload);
      return;
    }

    await uploadAtestado(payload);
  };

  const handleDownload = async (atestado: Atestado) => {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(atestado.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const handlePreview = async (atestado: Atestado) => {
    setSelectedAtestado(atestado);
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(atestado.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  };

  const limparFiltros = () => {
    setFiltroAno("todos");
    setFiltroMes("todos");
  };

  // Extrai anos e meses disponíveis
  const anosDisponiveis = [...new Set(atestados.map(a => new Date(a.data_atestado + "T00:00:00").getFullYear()))].sort((a, b) => b - a);
  const mesesDisponiveis = [...new Set(atestados.map(a => new Date(a.data_atestado + "T00:00:00").getMonth() + 1))].sort((a, b) => b - a);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Meus Atestados
        </h1>
        <p className="text-muted-foreground mt-1">
          Envie atestados médicos e acompanhe a aprovação.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle>Novo Atestado</CardTitle>
          <p className="text-sm text-muted-foreground">
            <AlertTriangle className="size-4 inline mr-1 text-amber-500" />
            Atestados devem ser enviados em até <strong>48 horas</strong> após a data de afastamento.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-atestado">Data do atestado *</Label>
                <Input
                  id="data-atestado"
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  max={hojeStr}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dias">Dias de afastamento *</Label>
                <Input
                  id="dias"
                  type="number"
                  min={0}
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  required
                />
                {data && dias && parseInt(dias) > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold">Data de retorno:</span>{" "}
                    {calcularDataRetorno(data, parseInt(dias))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="obs">Observação opcional</Label>
              <Textarea
                id="obs"
                rows={3}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações adicionais..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Arquivo (PDF, JPG ou PNG) *</Label>
              <Input
                id="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={onFileChange}
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {duplicate && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>Já existe um atestado neste dia. Você poderá confirmar o envio após este aviso.</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Enviando...</> : <><Upload className="size-4 mr-2" /> Enviar atestado</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <CardTitle>Histórico de Atestados</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anosDisponiveis.map(a => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {mesesDisponiveis.map(m => (
                    <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="mt-6 h-9">
              Limpar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : atestados.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Nenhum atestado encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {atestados.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <div className="font-medium">
                        Atestado - {formatBR(new Date(a.data_atestado + "T00:00:00"))}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{a.dias_afastamento} {a.dias_afastamento === 1 ? "dia" : "dias"}</span>
                        {a.status && (
                          <Badge className={statusClass(a.status)}>
                            {formatAtestadoStatus(a.status)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => handlePreview(a)}
                    >
                      <Eye className="size-4 mr-1" /> Visualizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 hover:bg-primary/5"
                      onClick={() => handleDownload(a)}
                    >
                      <Download className="size-4 mr-1" /> Baixar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Atestado</DialogTitle>
            <DialogDescription>
              {selectedAtestado
                ? `Atestado de ${formatBR(new Date(selectedAtestado.data_atestado + "T00:00:00"))}`
                : "Atestado"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-[600px] border-0"
                title="Visualização do atestado"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Carregando visualização...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (selectedAtestado) handleDownload(selectedAtestado);
              }}
            >
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação de duplicata */}
      <AlertDialog open={!!pendingUpload} onOpenChange={(open) => !open && setPendingUpload(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atestado duplicado?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um atestado para esta data. Confirme apenas se este arquivo realmente precisa ser enviado novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingUpload && uploadAtestado(pendingUpload)}>
              Confirmar envio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}