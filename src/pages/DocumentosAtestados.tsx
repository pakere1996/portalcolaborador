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
import { DocumentPreview } from "@/components/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { FileText, Upload, AlertTriangle, Loader2, CalendarDays, UserCheck } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface Atestado {
  id: string;
  user_id: string;
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

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: items, error } = await supabase
      .from("atestados")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) toast.error("Erro ao carregar atestados", { description: error.message });
    setAtestados((items ?? []) as Atestado[]);
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
          user_id: user.id,
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
    if (!file || !data || !dias) return toast.error("Preencha todos os campos obrigatórios");

    const payload = { data, dias, observacao, file };
    if (duplicate) {
      setPendingUpload(payload);
      return;
    }

    await uploadAtestado(payload);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Meus Atestados
        </h1>
        <p className="text-muted-foreground mt-1">
          Envie atestados médicos e acompanhe a aprovação.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Novo atestado
            </h2>
            <p className="text-sm text-muted-foreground mt-1">PDF, JPG ou PNG.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data-atestado">Data do atestado</Label>
            <Input id="data-atestado" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias">Dias de afastamento</Label>
            <Input id="dias" type="number" min={0} value={dias} onChange={(e) => setDias(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observação opcional</Label>
            <Textarea id="obs" rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Informações adicionais..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo</Label>
            <Input id="file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFileChange} />
          </div>

          {duplicate && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>Já existe um atestado neste dia. Você poderá confirmar o envio após este aviso.</span>
            </div>
          )}

          <Button className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Enviando...</> : <><Upload className="size-4 mr-2" /> Enviar atestado</>}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" /> Histórico
              </h2>
              <p className="text-sm text-muted-foreground">Somente seus próprios atestados aparecem aqui.</p>
            </div>
            <Badge className={statusClass("pendente")}>Pendente</Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : atestados.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhum atestado enviado.
            </div>
          ) : (
            <div className="grid gap-4">
              {atestados.map((a) => (
                <div key={a.id} className="rounded-2xl border bg-card p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold">Atestado de {formatBR(new Date(a.data_atestado + "T00:00:00"))}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <UserCheck className="size-3" /> {a.dias_afastamento} {a.dias_afastamento === 1 ? "dia" : "dias"} de afastamento
                      </div>
                    </div>
                    <Badge className={statusClass(a.status)}>{formatAtestadoStatus(a.status)}</Badge>
                  </div>

                  {a.observacao && (
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <span className="font-semibold">Sua observação:</span> {a.observacao}
                    </div>
                  )}

                  {a.status === "rejeitado" && (
                    <div className="rounded-xl border border-unavailable/30 bg-unavailable/5 p-3 text-sm text-unavailable">
                      <span className="font-semibold">Motivo da rejeição:</span> {a.observacao_admin || "Sem justificativa informada."}
                    </div>
                  )}

                  {a.status === "aprovado" && (
                    <div className="rounded-xl border border-available/30 bg-available/5 p-3 text-sm text-available">
                      Atestado aprovado.
                    </div>
                  )}

                  <DocumentPreview path={a.storage_path} kind={a.storage_type} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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