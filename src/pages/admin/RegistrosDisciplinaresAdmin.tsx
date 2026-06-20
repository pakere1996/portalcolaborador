"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  disciplinarStoragePath,
  formatDisciplinarTipo,
  getFileKind,
  newDocumentId,
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
import { AlertTriangle, FileText, Loader2, ShieldAlert, Trash2, Upload } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import { Tables } from "@/integrations/supabase/types";

interface Profile {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface Registro {
  id: string;
  user_id: string;
  colaborador_id: string;
  tipo: string;
  data: string;
  observacao: string | null;
  storage_path: string;
  storage_type: string;
  criado_por: string | null;
  created_at: string;
}

interface PendingUpload {
  colaboradorId: string;
  tipo: string;
  data: string;
  observacao: string;
  file: File;
  unidadeId: string;
}

type Unidade = Tables<'unidades'>;

export default function AdminDocumentosDisciplinarPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  // Formulário
  const [unidadeId, setUnidadeId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo] = useState("advertencia");
  const [data, setData] = useState("");
  const [observacao, setObservacao] = useState("");
  
  const [duplicate, setDuplicate] = useState<Registro | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);

  const load = async () => {
    setLoading(true);
    const [
      { data: profs, error: profError }, 
      { data: items, error: regError },
      { data: units, error: unitError }
    ] = await Promise.all([
      supabase.from("profiles").select("id, nome, unidade_id").eq("ativo", true).order("nome"),
      supabase.from("registros_disciplinares").select("*").order("created_at", { ascending: false }),
      supabase.from("unidades").select("*").order("nome"),
    ]);

    if (profError) toast.error("Erro ao carregar colaboradores", { description: profError.message });
    if (regError) toast.error("Erro ao carregar registros", { description: regError.message });
    if (unitError) toast.error("Erro ao carregar unidades", { description: unitError.message });

    setProfiles((profs ?? []) as Profile[]);
    setRegistros((items ?? []) as Registro[]);
    setUnidades((units ?? []) as Unidade[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const checkDuplicate = async () => {
      if (!colaboradorId || !data) {
        setDuplicate(null);
        return;
      }

      const { data: existing } = await supabase
        .from("registros_disciplinares")
        .select("*")
        .eq("colaborador_id", colaboradorId)
        .eq("tipo", tipo)
        .eq("data", data)
        .maybeSingle();

      setDuplicate((existing as Registro | null) ?? null);
    };

    checkDuplicate();
  }, [colaboradorId, tipo, data]);

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

  const filteredProfiles = useMemo(() => {
    if (!unidadeId) return [];
    return profiles.filter(p => p.unidade_id === unidadeId);
  }, [profiles, unidadeId]);

  const uploadRegistro = async (payload: PendingUpload) => {
    if (!user) return;

    setBusy(true);
    try {
      const id = newDocumentId();
      const storagePath = disciplinarStoragePath(payload.colaboradorId, payload.data, payload.tipo, id, payload.file);
      const kind = getFileKind(payload.file);

      if (!kind) throw new Error("Tipo de arquivo não suportado.");

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(storagePath, payload.file, {
          contentType: payload.file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("registros_disciplinares").insert({
        user_id: payload.colaboradorId,
        colaborador_id: payload.colaboradorId,
        tipo: payload.tipo,
        data: payload.data,
        observacao: payload.observacao.trim() || null,
        storage_path: storagePath,
        storage_type: kind,
        criado_por: user.id,
      });

      if (insertError) throw insertError;

      toast.success("Registro disciplinar cadastrado");
      setFile(null);
      setUnidadeId("");
      setColaboradorId("");
      setTipo("advertencia");
      setData("");
      setObservacao("");
      setDuplicate(null);
      load();
    } catch (error) {
      toast.error("Erro ao cadastrar registro", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unidadeId || !colaboradorId || !data || !file) return toast.error("Preencha todos os campos obrigatórios");

    const payload: PendingUpload = { colaboradorId, tipo, data, observacao, file, unidadeId };
    if (duplicate) {
      setPendingUpload(payload);
      return;
    }

    await uploadRegistro(payload);
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("registros_disciplinares").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Registro removido");
    load();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" /> Registros Disciplinares
        </h1>
        <p className="text-muted-foreground mt-1">
          Advertências e suspensões vinculadas a colaboradores.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Novo registro
            </h2>
            <p className="text-sm text-muted-foreground mt-1">PDF, JPG ou PNG.</p>
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
              <SelectTrigger><SelectValue placeholder="Escolha o colaborador" /></SelectTrigger>
              <SelectContent>
                {filteredProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {!unidadeId && <p className="text-xs text-red-500">Selecione uma unidade primeiro.</p>}
            {unidadeId && filteredProfiles.length === 0 && <p className="text-xs text-red-500">Nenhum colaborador ativo nesta unidade.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="advertencia">Advertência</SelectItem>
                  <SelectItem value="suspensao">Suspensão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={4} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Detalhes do registro..." />
          </div>

          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input type="file" accept="application/pdf,image/jpeg,image/png" onChange={onFileChange} />
          </div>

          {duplicate && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <span>Já existe este tipo de registro para este colaborador nesta data.</span>
            </div>
          )}

          <Button className="w-full" disabled={busy}>
            {busy ? <><Loader2 className="size-4 mr-2 animate-spin" /> Salvando...</> : <><Upload className="size-4 mr-2" /> Cadastrar</>}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Registros cadastrados</h2>
            <Badge variant="outline">{registros.length}</Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : registros.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhum registro disciplinar cadastrado.
            </div>
          ) : (
            <div className="grid gap-4">
              {registros.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-card p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {profiles.find((p) => p.id === r.colaborador_id)?.nome ?? "Colaborador"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDisciplinarTipo(r.tipo)} em {formatBR(new Date(r.data + "T00:00:00"))}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Badge className="bg-primary/10 text-primary border-primary/20">{formatDisciplinarTipo(r.tipo)}</Badge>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {r.observacao && (
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      {r.observacao}
                    </div>
                  )}

                  <DocumentPreview path={r.storage_path} kind={r.storage_type} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!pendingUpload} onOpenChange={(open) => !open && setPendingUpload(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar registro duplicado?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um registro do mesmo tipo para este colaborador nesta data. Confirme apenas se este arquivo realmente precisa ser enviado novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingUpload && uploadRegistro(pendingUpload)}>
              Confirmar cadastro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
