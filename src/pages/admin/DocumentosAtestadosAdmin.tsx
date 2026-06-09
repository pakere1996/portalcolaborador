import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { ensureDocumentosSchema } from "@/lib/ensure-documentos-schema";
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
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Upload, UserCheck, X } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface Profile {
  id: string;
  nome: string;
}

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
  criado_por: string | null;
  respondido_por: string | null;
  respondido_em: string | null;
  created_at: string;
}

interface PendingUpload {
  colaboradorId: string;
  data: string;
  dias: string;
  observacao: string;
  file: File;
}

export default function AdminDocumentosAtestadosPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [atestados, setAtestados] = useState<Atestado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [colaboradorId, setColaboradorId] = useState("");
  const [data, setData] = useState("");
  const [dias, setDias] = useState("");
  const [observacao, setObservacao] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroUser, setFiltroUser] = useState("todos");
  const [duplicate, setDuplicate] = useState<Atestado | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [adminObs, setAdminObs] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: profs, error: profError }, { data: items, error: atestError }] = await Promise.all([
      supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("atestados" as any).select("*").order("created_at", { ascending: false }),
    ]);

    if (profError) toast.error("Erro ao carregar colaboradores", { description: profError.message });
    if (atestError) toast.error("Erro ao carregar atestados", { description: atestError.message });

    setProfiles((profs ?? []) as Profile[]);
    setAtestados((items ?? []) as Atestado[]);
    setLoading(false);
  };

  useEffect(() => {
    ensureDocumentosSchema().catch((error) => toast.error("Erro ao preparar documentos", { description: error.message }));
    load();
  }, []);

  useEffect(() => {
    const checkDuplicate = async () => {
      if (!colaboradorId || !data) {
        setDuplicate(null);
        return;
      }

      const { data: existing } = await supabase
        .from("atestados" as any)
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .eq("data_atestado", data)
        .maybeSingle();

      setDuplicate((existing as Atestado | null) ?? null);
    };

    checkDuplicate();
  }, [colaboradorId, data]);

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
    if (!user) return;

    setBusy(true);
    try {
      const id = newDocumentId();
      const storagePath = atestadoStoragePath(payload.colaboradorId, payload.data, id, payload.file);
      const kind = getFileKind(payload.file);

      if (!kind) throw new Error("Tipo de arquivo não suportado.");

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, payload.file, {
          contentType: payload.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("atestados" as any).insert({
        user_id: payload.colaboradorId,
        colaborador_id: payload.colaboradorId,
        data_atestado: payload.data,
        dias_afastamento: Number(payload.dias),
        observacao: payload.observacao.trim() || null,
        observacao_admin: null,
        status: "pendente",
        storage_path: storagePath,
        storage_type: kind,
        criado_por: user.id,
      });

      if (insertError) throw insertError;

      toast.success("Atestado cadastrado como pendente");
      setFile(null);
      setColaboradorId("");
      setData("");
      setDias("");
      setObservacao("");
      setDuplicate(null);
      load();
    } catch (error) {
      toast.error("Erro ao cadastrar atestado", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colaboradorId || !data || !dias || !file) return toast.error("Preencha todos os campos obrigatórios");

    const payload = { colaboradorId, data, dias, observacao, file };
    if (duplicate) {
      setPendingUpload(payload);
      return;
    }

    await uploadAtestado(payload);
  };

  const decidir = async (a: Atestado, status: "aprovado" | "rejeitado") => {
    if (!user) return;

    const obs = (adminObs[a.id] ?? "").trim();
    if (status === "rejeitado" && !obs) {
      return toast.error("Informe uma justificativa para rejeitar");
    }

    setBusy(true);
    try {
      const { error } = await supabase.from("atestados" as any).update({
        status,
        observacao_admin: obs || null,
        respondido_por: user.id,
        respondido_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", a.id);

      if (error) throw error;
      toast.success(status === "aprovado" ? "Atestado aprovado" : "Atestado rejeitado");
      load();
    } catch (error) {
      toast.error("Erro ao atualizar atestado", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const filtered = atestados.filter((a) => {
    if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
    if (filtroUser !== "todos" && a.colaborador_id !== filtroUser) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Atestados
        </h1>
        <p className="text-muted-foreground mt-1">
          Cadastre, aprove ou rejeite atestados da equipe.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Novo atestado
            </h2>
            <p className="text-sm text-muted-foreground mt-1">O status inicial será Pendente.</p>
          </div>

          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select value={colaboradorId} onValueChange={setColaboradorId}>
              <SelectTrigger><SelectValue placeholder="Escolha o colaborador" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data do atestado</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dias de afastamento</Label>
              <Input type="number" min={0} value={dias} onChange={(e) => setDias(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação opcional</Label>
            <Textarea rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Informações adicionais..." />
          </div>

          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFileChange} />
          </div>

          {duplicate && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>Já existe um atestado neste colaborador nesta data.</span>
            </div>
          )}

          <Button className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Salvando...</> : <><Upload className="size-4 mr-2" /> Cadastrar</>}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="rejeitado">Rejeitados</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filtroUser} onValueChange={setFiltroUser}>
              <SelectTrigger><SelectValue placeholder="Colaborador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os colaboradores</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhum atestado encontrado.
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((a) => (
                <div key={a.id} className="rounded-2xl border bg-card p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {profiles.find((p) => p.id === a.colaborador_id)?.nome ?? "Colaborador"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Atestado em {formatBR(new Date(a.data_atestado + "T00:00:00"))} • {a.dias_afastamento} {a.dias_afastamento === 1 ? "dia" : "dias"}
                      </div>
                    </div>
                    <Badge className={statusClass(a.status)}>{formatAtestadoStatus(a.status)}</Badge>
                  </div>

                  {a.observacao && (
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <span className="font-semibold">Observação do colaborador:</span> {a.observacao}
                    </div>
                  )}

                  {a.status === "rejeitado" && (
                    <div className="rounded-xl border border-unavailable/30 bg-unavailable/5 p-3 text-sm text-unavailable">
                      <span className="font-semibold">Justificativa:</span> {a.observacao_admin || "Sem justificativa."}
                    </div>
                  )}

                  <DocumentPreview path={a.storage_path} kind={a.storage_type} />

                  {a.status === "pendente" && (
                    <div className="grid gap-3">
                      <div className="space-y-2">
                        <Label>Observação do admin para rejeição</Label>
                        <Textarea
                          rows={2}
                          value={adminObs[a.id] ?? ""}
                          onChange={(e) => setAdminObs({ ...adminObs, [a.id]: e.target.value })}
                          placeholder="Obrigatória ao rejeitar"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" onClick={() => decidir(a, "aprovado")} disabled={busy}>
                          <UserCheck className="size-4 mr-2" /> Aprovar
                        </Button>
                        <Button variant="destructive" onClick={() => decidir(a, "rejeitado")} disabled={busy}>
                          <X className="size-4 mr-2" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  )}
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
              Já existe um atestado para este colaborador nesta data. Confirme apenas se este arquivo realmente precisa ser enviado novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingUpload && uploadAtestado(pendingUpload)}>
              Confirmar cadastro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}