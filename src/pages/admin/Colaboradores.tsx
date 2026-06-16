import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, Search, Key, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { Badge } from "@/components/ui/badge";
import { ColaboradorFormDialog } from "@/components/ColaboradorFormDialog";
import { Tables } from "@/integrations/supabase/types";
import { adminApi } from "@/lib/admin-api";

type Profile = Tables<'profiles'> & { role?: string | null };
type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;

const blankEditForm = {
  nome: "", cpf: "", matricula: "", email: "", whatsapp: "",
  cargo: "", unidadeId: "none", folgaFixa: "none",
  dataAdmissao: "", dataNascimento: "", perfil_acesso: "colaborador",
  ativo: true,
  senha: "",
};

export default function Colaboradores() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroCargo, setFiltroCargo] = useState("all");

  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [newForm, setNewForm] = useState(blankEditForm);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState(blankEditForm);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ profile: Profile; senha: string; confirmar: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, uRes, cRes] = await Promise.all([
        supabase.from("profiles").select("*").order("nome"),
        supabase.from("unidades").select("*").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("*").eq("ativo", true).order("nome"),
      ]);

      const profileIds = (pRes.data ?? []).map(p => p.id);
      let rolesMap = new Map<string, string[]>();
      if (profileIds.length > 0) {
        const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", profileIds);
        rolesData?.forEach(r => {
          if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
          rolesMap.get(r.user_id)!.push(r.role);
        });
      }

      const profilesWithRoles = (pRes.data ?? []).map(p => ({
        ...p,
        role: rolesMap.get(p.id)?.[0] ?? null,
      }));

      setProfiles(profilesWithRoles);
      setUnidades(uRes.data ?? []);
      setCargos(cRes.data ?? []);
    } catch (e) {
      toast.error("Erro ao carregar dados", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpf.includes(search.replace(/\D/g, ""));
    const matchesUnidade = filtroUnidade === "all" || p.unidade_id === filtroUnidade;
    const matchesStatus = filtroStatus === "all" || (filtroStatus === "ativo" ? p.ativo : !p.ativo);
    const matchesCargo = filtroCargo === "all" || p.cargo === filtroCargo;
    return matchesSearch && matchesUnidade && matchesStatus && matchesCargo;
  });

  const uniqueCargos = [...new Set(profiles.map(p => p.cargo).filter(Boolean))];

  const handleCreate = async () => {
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(newForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { data: authUser, error: authErr } = await adminApi.createUser({
        nome: newForm.nome.trim(),
        cpf: cleanCpf,
email: newForm.email.trim().toLowerCase() || `${cleanCpf}@pakere.com.br`,
        senha: newForm.senha || cleanCpf.slice(-6),
        cargo: newForm.cargo,
        dataAdmissao: newForm.dataAdmissao,
        dataNascimento: newForm.dataNascimento,
        folgaFixaSemana: newForm.folgaFixa === "none" ? null : Number(newForm.folgaFixa),
        role: newForm.perfil_acesso,
      });

      if (authErr) throw authErr;

      const { error: profErr } = await supabase.from("profiles").update({
        matricula: newForm.matricula.trim() || null,
        whatsapp: newForm.whatsapp.trim() || null,
        unidade_id: newForm.unidadeId === "none" ? null : newForm.unidadeId,
        ativo: true,
      }).eq("id", authUser.userId);

      if (profErr) throw profErr;

      toast.success("Colaborador criado com sucesso!");
      setOpenNewDialog(false);
      setNewForm(blankEditForm);
      loadData();
    } catch (e) {
      toast.error("Erro ao criar colaborador", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (p: Profile) => {
    setEditingProfile(p);
    setEditForm({
      nome: p.nome,
      cpf: formatCPF(p.cpf),
      matricula: p.matricula ?? "",
email: p.email_contato ?? "",
      whatsapp: p.whatsapp ?? "",
      cargo: p.cargo,
      unidadeId: p.unidade_id ?? "none",
      folgaFixa: p.folga_fixa_semana?.toString() ?? "none",
      dataNascimento: p.data_nascimento ?? "",
      dataAdmissao: p.data_admissao ?? "",
      perfil_acesso: p.role ?? "colaborador",
      ativo: p.ativo,
      senha: "",
    });
  };

  const handleUpdate = async () => {
    if (!editingProfile) return;
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(editForm.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { error: profErr } = await supabase.from("profiles").update({
        nome: editForm.nome.trim(),
        cpf: cleanCpf,
        matricula: editForm.matricula.trim() || null,
        email: editForm.email.trim() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        cargo: editForm.cargo,
        unidade_id: editForm.unidadeId === "none" ? null : editForm.unidadeId,
        folga_fixa_semana: editForm.folgaFixa === "none" ? null : Number(editForm.folgaFixa),
        data_nascimento: editForm.dataNascimento || null,
        data_admissao: editForm.dataAdmissao || null,
        ativo: editForm.ativo,
        updated_at: new Date().toISOString(),
      }).eq("id", editingProfile.id);

      if (profErr) throw profErr;

      const currentRole = editingProfile.role;
      const newRole = editForm.perfil_acesso;
      if (currentRole !== newRole) {
        if (currentRole) {
          await supabase.from("user_roles").delete().eq("user_id", editingProfile.id).eq("role", currentRole);
        }
        await supabase.from("user_roles").upsert({ user_id: editingProfile.id, role: newRole }, { onConflict: "user_id,role" });
      }

      toast.success("Colaborador atualizado!");
      setEditingProfile(null);
      loadData();
    } catch (e) {
      toast.error("Erro ao atualizar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteUser(confirmDelete.id);
      toast.success("Colaborador excluído.");
      setConfirmDelete(null);
      loadData();
    } catch (e) {
      toast.error("Erro ao excluir", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openResetPassword = (p: Profile) => {
    setResetPasswordDialog({ profile: p, senha: "", confirmar: "" });
  };

  const doResetPassword = async () => {
    if (!resetPasswordDialog) return;
    if (resetPasswordDialog.senha !== resetPasswordDialog.confirmar) return toast.error("As senhas não conferem");
    if (resetPasswordDialog.senha.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    setBusy(true);
    try {
      await adminApi.resetPassword(resetPasswordDialog.profile.id, resetPasswordDialog.senha);
      toast.success("Senha redefinida com sucesso!");
      setResetPasswordDialog(null);
    } catch (e) {
      toast.error("Erro ao redefinir senha", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie a equipe, cargos e acessos ao sistema.</p>
        </div>
        <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Novo Colaborador</Button>
          </DialogTrigger>
          <ColaboradorFormDialog
            open={openNewDialog}
            onOpenChange={setOpenNewDialog}
            form={newForm}
            setForm={setNewForm}
            unidades={unidades}
            cargos={cargos}
            busy={busy}
            isEdit={false}
            onSave={handleCreate}
          />
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Unidade</Label>
          <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[200px]">
            <option value="all">Todas</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Status</Label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[160px]">
            <option value="all">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase text-muted-foreground">Cargo</Label>
          <select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)} className="bg-input border border-border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-[200px]">
            <option value="all">Todos</option>
            {uniqueCargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="size-8 animate-spin mx-auto mb-2 text-primary" />
            Carregando colaboradores...
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">Nenhum colaborador encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Colaborador</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">CPF</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Cargo</th>
                  <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden xl:table-cell">Unidade</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Perfil</th>
                  <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProfiles.map((p) => (
                  <tr key={p.id} className={p.ativo ? "" : "opacity-50"}>
                    <td className="p-4 font-medium">{p.nome}</td>
                    <td className="p-4 hidden md:table-cell font-mono text-xs">{formatCPF(p.cpf)}</td>
                    <td className="p-4 hidden lg:table-cell text-muted-foreground">{p.cargo}</td>
                    <td className="p-4 hidden xl:table-cell text-muted-foreground">
                      {unidades.find(u => u.id === p.unidade_id)?.nome ?? "—"}
                    </td>
                    <td className="p-4 text-center">
                      <Switch checked={p.ativo} onCheckedChange={async (checked) => {
                        await supabase.from("profiles").update({ ativo: checked, updated_at: new Date().toISOString() }).eq("id", p.id);
                        loadData();
                      }} disabled={busy} />
                    </td>
                    <td className="p-4 text-center">
                      <Badge className={p.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"}>
                        {p.role === "admin" ? "Admin" : "Colaborador"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(p)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" title="Redefinir Senha" onClick={() => openResetPassword(p)}>
                          <Key className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" title="Excluir" onClick={() => setConfirmDelete(p)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ColaboradorFormDialog
        open={!!editingProfile}
        onOpenChange={(open) => { if (!open) setEditingProfile(null); }}
        form={editForm}
        setForm={setEditForm}
        unidades={unidades}
        cargos={cargos}
        busy={busy}
        isEdit={true}
        onSave={handleUpdate}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O usuário será removido do Auth e o perfil será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 text-white hover:bg-red-700" disabled={busy}>
              {busy ? "Excluindo..." : "Excluir Permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!resetPasswordDialog} onOpenChange={(o) => !o && setResetPasswordDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha de {resetPasswordDialog?.profile.nome}</AlertDialogTitle>
            <AlertDialogDescription>
              A nova senha será aplicada imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova Senha</Label>
              <Input id="nova-senha" type="password" value={resetPasswordDialog?.senha} onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog!, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar Senha</Label>
              <Input id="confirmar-senha" type="password" value={resetPasswordDialog?.confirmar} onChange={(e) => setResetPasswordDialog({ ...resetPasswordDialog!, confirmar: e.target.value })} placeholder="Repita a senha" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doResetPassword} className="bg-primary text-white hover:bg-primary/90" disabled={busy}>
              {busy ? "Salvando..." : "Redefinir Senha"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}