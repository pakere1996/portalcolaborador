"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Upload, AlertTriangle, Loader2, CalendarDays, UserCheck, Eye, Download } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface Atestado {
  id: string;
  colaborador_id: string;
  unidade_id: string | null;
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
  const [pendingUpload, setPendingUpload] = useState<{ data: string; dias: string; observacao: string; file: File } | null>(null);

  const [filtroAno, setFiltroAno] = useState<string>("todos");
  const [filtroMes, setFiltroMes] = useState<string>("todos");
  const [anos, setAnos] = useState<number[]>([]);
  const [meses, setMeses] = useState<number[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedAtestado, setSelectedAtestado] = useState<Atestado | null>(null);

  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: items, error } = await supabase
      .from("atestados")
      .select("*")
      .eq("colaborador_id", user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Erro ao carregar atestados", { description: error.message });
    setAtestados((items ?? []) as Atestado[]);

    const anosSet = new Set(items?.map(a => new Date(a.data_atestado + "T00:00:00").getFullYear()) ?? []);
    const mesesSet = new Set(items?.map(a => new Date(a.data_atestado + "T00:00:00").getMonth() + 1) ?? []);
    setAnos(Array.from(anosSet).sort((a, b) => b - a));
    setMeses(Array.from(mesesSet).sort((a, b) => b - a));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

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
  }, [data, user?.id]);

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

  const uploadAtestado = async (payload: { data: string; dias: string; observacao: string; file: File }) => {
    if (!user || !profile) return;

    if (payload.data > hojeStr) {
      toast.error("Data do atestado não pode ser futura");
      return;
    }
    if (!payload.dias || parseInt(payload.dias) <= 0) {
      toast.error("Informe a quantidade de dias de afastamento");
      return;
    }

    const dataAtestado = new Date(payload.data + "T00:00:00");
    const diffHoras = (hoje.getTime() - dataAtestado.getTime()) / (1000 * 60 * 60);
    if (diffHoras > 48) {
      toast.warning("Atenção: Atestados devem ser enviados em até 48h da data de afastamento", {
        description: "Recomendamos entrar em contato com o RH para justificar o atraso.",
      });
    }

    setBusy(true);
    try {
      // 🔥 Busca a unidade do colaborador
      const { data: profileData } = await supabase
        .from("profiles")
        .select("unidade_id")
        .eq("id", user.id)
        .single();

      const unidadeId = profileData?.unidade_id || null;

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

      // 🔥 Inclui unidade_id no insert
      const { data: inserted, error: insertError } = await supabase
        .from("atestados")
        .insert({
          colaborador_id: user.id,
          unidade_id: unidadeId,
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

      // Notifica admin (silencia erro 404)
      try {
        const { notifyAtestadoPendente } = await import("@/lib/notify-atestado");
        await notifyAtestadoPendente(inserted.id, profile.nome);
      } catch (notifyError) {
        console.warn("Notificação não disponível:", notifyError);
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
    const payload = { data, dias, observacao, file };
    if (duplicate) {
      setPendingUpload(payload);
      return;
    }
    await uploadAtestado(payload);
  };

  const handleDownload = async (doc: Atestado) => {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link de download");
    }
  };

  const handlePreview = async (doc: Atestado) => {
    setSelectedAtestado(doc);
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.storage_path, 60);
    if (data?.signedUrl) {
      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } else {
      toast.error("Erro ao gerar link de visualização");
    }
  };

  const getDataRetorno = (dataAtestado: string, dias: number) => {
    const dt = new Date(dataAtestado + "T00:00:00");
    dt.setDate(dt.getDate() + dias);
    return formatBR(dt);
  };

  const atestadosFiltrados = atestados.filter(a => {
    const dataObj = new Date(a.data_atestado + "T00:00:00");
    if (filtroAno !== "todos" && dataObj.getFullYear() !== parseInt(filtroAno)) return false;
    if (filtroMes !== "todos" && dataObj.getMonth() + 1 !== parseInt(filtroMes)) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Meus Atestados
        </h1>
        <p className="text-muted-foreground mt-1">
          Envie atestados médicos e acompanhe a aprovação. Atestados devem ser enviados em até 48h da data de afastamento.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Novo atestado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="data-atestado">Data do atestado *</Label>
                <Input
                  id="data-atestado"
                  type="date"
                  max={hojeStr}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">A data não pode ser futura.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dias">Dias de afastamento *</Label>
                <Input
                  id="dias"
                  type="number"
                  min={1}
                  value={dias}
                  onChange={(e) => setDias(e.target.value)}
                  placeholder="Ex: 3"
                />
                {data && dias && parseInt(dias) > 0 && (
                  <p className="text-xs text-green-600">
                    Data de retorno: {getDataRetorno(data, parseInt(dias))}
                  </p>
                )}
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
                <Label htmlFor="file">Arquivo (PDF ou Imagem) *</Label>
                <Input
                  id="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={onFileChange}
                />
                {file && <p className="text-xs text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
              </div>

              {duplicate && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <span>Já existe um atestado nesta data. Confirme o envio para substituir.</span>
                </div>
              )}

              <Button className="w-full" disabled={busy}>
                {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Enviando...</> : <><Upload className="size-4 mr-2" /> Enviar atestado</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" /> Histórico
            </h2>
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Ano</Label>
                <Select value={filtroAno} onValueChange={setFiltroAno}>
                  <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Mês</Label>
                <Select value={filtroMes} onValueChange={setFiltroMes}>
                  <SelectTrigger className="w-[100px] h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {meses.map(m => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : atestadosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhum atestado encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {atestadosFiltrados.map((a) => (
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
                        Atestado {formatBR(new Date(a.data_atestado + "T00:00:00"))}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{a.dias_afastamento} dia(s)</span>
                        <span>•</span>
                        <span>Retorno: {getDataRetorno(a.data_atestado, a.dias_afastamento)}</span>
                      </div>
                      <Badge className={statusClass(a.status)}>{formatAtestadoStatus(a.status)}</Badge>
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
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualização do Atestado</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[500px] bg-muted/20 rounded-lg overflow-hidden">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-[600px] border-0" title="Visualização do atestado" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">Carregando...</div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={() => { if (selectedAtestado) handleDownload(selectedAtestado); }}>
              <Download className="size-4 mr-1" /> Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingUpload} onOpenChange={(open) => !open && setPendingUpload(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar envio duplicado?</AlertDialogTitle>
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