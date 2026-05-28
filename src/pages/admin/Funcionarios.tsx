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
import { Plus, Users, Pencil, Trash2, KeyRound, Cake, CalendarDays, RefreshCw, Shield } from "lucide-react";
import { formatCPF, isValidCPFLength, onlyDigits } from "@/lib/cpf";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";

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
  role?: string;
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
    const [{ data: profs }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, cpf, cargo, ativo, aprovacao_status, data_admissao, data_demissao, data_nascimento, folga_fixa_semana")
        .order("nome"),
      supabase.from("user_roles").select("user_id, role")
    ]);

    const roleMap = new Map((roles ?? []).map(r => [r.user_id, r.role]));
    
    const combined = (profs ?? []).map(p => ({
      ...p,
      role: roleMap.get(p.id) || "funcionario"
    }));

    setList(combined as Profile[]);
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

  const syncAccess = async (p: Profile) => {
    const toastId = toast.loading(`Sincronizando acesso de ${p.nome}...`);
    try {
      await adminApi.createUser({
        nome: p.nome,
        cpf: onlyDigits(p.cpf),
        cargo: p.cargo,
        senha: "mudar123456", // Senha temporária para reparo
        dataAdmissao: p.data_admissao,
        dataNascimento: p.data_nascimento,
        folgaFixaSemana: p.folga_fixa_semana,
        role: p.role, // Mantém o papel atual
      });
      toast.success("Acesso sincronizado!", { 
        id: toastId,
        description: "O login foi reparado. Use a função de 'Chave' para definir a senha final." 
      });
      load();
    } catch (e) {
      toast.error("Erro na sincronização", { id: toastId, description: (e as Error).message });
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
            <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Novo Funcionário</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                    maxLength={14}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Ex: Pizzaiolo" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input type="date" value={form.dataNascimento} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input type="date" value={form.dataAdmissao} onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Folga Semanal</Label>
                <select
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  value={form.folgaFixa}
                  onChange={(e) => setForm({ ...form, folgaFixa: e.target.value })}
                >
                  <option value="">— Sem folga semanal —</option>
                  {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Senha Inicial</Label>
                <Input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={create} disabled={busy}>{busy ? "Salvando..." : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Funcionário</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Cargo</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Nascimento</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Folga Semanal</th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Nenhum funcionário cadastrado.</td></tr>
              )}
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-foreground">{p.nome}</div>
                      {p.role === "admin" && <Shield className="size-3 text-primary" title="Administrador" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">{formatCPF(p.cpf)}</div>
                    {p.aprovacao_status === "pendente" && (
                      <Badge variant="outline" className="mt-1 bg-orange-50 text-orange-600 border-orange-200 text-[9px]">Pendente</Badge>
                    )}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-muted-foreground">{p.cargo}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    {p.data_nascimento ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Cake className="size-3 text-amber-500" />
                        {new Date(p.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="p-4">
                    {p.folga_fixa_semana != null ? (
                      <div className="flex items-center gap-1.5 font-bold text-blue-600">
                        <CalendarDays className="size-3" />
                        {WEEKDAYS[p.folga_fixa_semana]}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" title="Sincronizar Acesso" onClick={() => syncAccess(p)}>
                        <RefreshCw className="size-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(p)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="Redefinir senha" onClick={() => setResetting(p)}>
                        <KeyRound className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50" title="Excluir" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar funcionário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cargo</Label><Input value={editForm.cargo} onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Admissão</Label>
                <Input type="date" value={editForm.dataAdmissao} onChange={(e) => setEditForm({ ...editForm, dataAdmissao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Demissão</Label>
                <Input type="date" value={editForm.dataDemissao} onChange={(e) => setEditForm({ ...editForm, dataDemissao: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={editForm.dataNascimento} onChange={(e) => setEditForm({ ...editForm, dataNascimento: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Folga Semanal</Label>
              <select
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                value={editForm.folgaFixa}
                onChange={(e) => setEditForm({ ...editForm, folgaFixa: e.target.value })}
              >
                <option value="">— Sem folga semanal —</option>
                {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && (setResetting(null), setNewPwd(""))}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha — {resetting?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Nova Senha</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setResetting(null); setNewPwd(""); }}>Cancelar</Button>
            <Button onClick={doReset}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <AlertDialogAction onClick={doDelete} className="bg-red-600 text-white hover:bg-red-700">
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}