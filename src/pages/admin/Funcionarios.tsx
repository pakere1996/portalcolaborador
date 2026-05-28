import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, KeyRound } from "lucide-react";
import { formatCPF, isValidCPFLength, onlyDigits } from "@/lib/cpf";
import { adminApi } from "@/lib/admin-api";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Profile {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  ativo: boolean;
  aprovacao_status: string;
  data_admissao: string | null;
  data_demissao: string | null;
  data_nascimento: string | null;
  folga_fixa_semana: number | null;
}

const blankForm = {
  nome: "",
  cpf: "",
  cargo: "Pizzaiolo",
  senha: "",
  dataAdmissao: "",
  dataNascimento: "",
  folgaFixa: "",
};

export default function Funcionarios() {
  const [list, setList] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "", cargo: "", dataAdmissao: "", dataDemissao: "", dataNascimento: "", folgaFixa: "",
  });

  const [resetting, setResetting] = useState<Profile | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, cpf, cargo, ativo, aprovacao_status, data_admissao, data_demissao, data_nascimento, folga_fixa_semana")
      .order("nome");
    setList((data ?? []) as Profile[]);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (!isValidCPFLength(form.cpf)) return toast.error("CPF inválido");
    if (form.senha.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    setBusy(true);
    try {
      await adminApi.createUser({
        nome: form.nome.trim(),
        cpf: onlyDigits(form.cpf),
        cargo: form.cargo.trim() || "Funcionário",
        senha: form.senha,
        dataAdmissao: form.dataAdmissao || null,
        dataNascimento: form.dataNascimento || null,
        folgaFixaSemana: form.folgaFixa === "" ? null : Number(form.folgaFixa),
        role: "funcionario",
      });
      toast.success("Funcionário cadastrado");
      setOpen(false);
      setForm(blankForm);
      load();
    } catch (e) {
      toast.error("Erro ao cadastrar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    setEditForm({
      nome: p.nome,
      cargo: p.cargo,
      dataAdmissao: p.data_admissao ?? "",
      dataDemissao: p.data_demissao ?? "",
      dataNascimento: p.data_nascimento ?? "",
      folgaFixa: p.folga_fixa_semana == null ? "" : String(p.folga_fixa_semana),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: editForm.nome.trim(),
        cargo: editForm.cargo.trim() || "Funcionário",
        data_admissao: editForm.dataAdmissao || null,
        data_demissao: editForm.dataDemissao || null,
        data_nascimento: editForm.dataNascimento || null,
        folga_fixa_semana: editForm.folgaFixa === "" ? null : Number(editForm.folgaFixa),
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
    setEditing(null);
    load();
  };

  const toggleAtivo = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  };

  const doReset = async () => {
    if (!resetting) return;
    if (newPwd.length < 6) return toast.error("Mínimo 6 caracteres");
    try {
      await adminApi.resetPassword(resetting.id, newPwd);
      toast.success("Senha redefinida");
      setResetting(null);
      setNewPwd("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await adminApi.deleteUser(confirmDelete.id);
      toast.success("Funcionário excluído");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Funcionários
          </h1>
          <p className="text-muted-foreground mt-1">Cadastre e gerencie a equipe.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div>
                <Label>CPF</Label>
                <Input
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                  maxLength={14}
                  placeholder="000.000.000-00"
                />
              </div>
              <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de admissão</Label>
                  <Input type="date" value={form.dataAdmissao} onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })} />
                </div>
                <div>
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Folga fixa semanal</Label>
                <select
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                  value={form.folgaFixa}
                  onChange={(e) => setForm({ ...form, folgaFixa: e.target.value })}
                >
                  <option value="">— sem folga fixa —</option>
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div><Label>Senha inicial</Label><Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={create} disabled={busy}>{busy ? "Salvando..." : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 hidden md:table-cell">CPF</th>
              <th className="text-left p-3 hidden lg:table-cell">Cargo</th>
              <th className="text-left p-3 hidden xl:table-cell">Nascimento</th>
              <th className="text-left p-3 hidden xl:table-cell">Folga fixa</th>
              <th className="text-left p-3 hidden lg:table-cell">Admissão</th>
              <th className="text-center p-3">Ativo</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum funcionário cadastrado.</td></tr>
            )}
            {list.map((p) => (
              <tr key={p.id}>
                <td className="p-3 font-medium">
                  {p.nome}
                  {p.aprovacao_status === "pendente" && (
                    <span className="ml-2 text-xs bg-pending/20 text-pending-foreground px-2 py-0.5 rounded">pendente</span>
                  )}
                </td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{formatCPF(p.cpf)}</td>
                <td className="p-3 hidden lg:table-cell text-muted-foreground">{p.cargo}</td>
                <td className="p-3 hidden xl:table-cell text-muted-foreground">
                  {p.data_nascimento ? new Date(p.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-3 hidden xl:table-cell text-muted-foreground">
                  {p.folga_fixa_semana == null ? "—" : WEEKDAYS[p.folga_fixa_semana]}
                </td>
                <td className="p-3 hidden lg:table-cell text-muted-foreground">
                  {p.data_admissao ? new Date(p.data_admissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-3 text-center">
                  <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(p)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Redefinir senha" onClick={() => setResetting(p)}>
                    <KeyRound className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => setConfirmDelete(p)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar funcionário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Admissão</Label>
                <Input type="date" value={editForm.dataAdmissao} onChange={(e) => setEditForm({ ...editForm, dataAdmissao: e.target.value })} />
              </div>
              <div>
                <Label>Demissão</Label>
                <Input type="date" value={editForm.dataDemissao} onChange={(e) => setEditForm({ ...editForm, dataDemissao: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input type="date" value={editForm.dataNascimento} onChange={(e) => setEditForm({ ...editForm, dataNascimento: e.target.value })} />
            </div>
            <div>
              <Label>Folga fixa semanal</Label>
              <select
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                value={editForm.folgaFixa}
                onChange={(e) => setEditForm({ ...editForm, folgaFixa: e.target.value })}
              >
                <option value="">— sem folga fixa —</option>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && (setResetting(null), setNewPwd(""))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha — {resetting?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetting(null); setNewPwd(""); }}>Cancelar</Button>
            <Button onClick={doReset}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o login e o histórico associado. Não pode ser desfeita.
              Se preferir manter o histórico, use a opção "Desativar" no toggle Ativo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}