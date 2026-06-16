import { Link } from "react-router-dom";
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
import { Plus, Users, Shield, UserCheck, Mail, Phone, Calendar, CalendarDays, CalendarX, CalendarCheck, Filter, Calendar as CalendarIcon, ClipboardList, FileText, FileWarning, ArrowLeftRight, Ban, Building2, Briefcase, ShieldAlert } from "lucide-react";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { formatPhone, cleanCNPJ, formatCNPJ } from "@/lib/utils";
import { ColaboradorForm } from "@/components/ColaboradorForm";
import { ColaboradorFormDialog } from "@/components/ColaboradorFormDialog";
import { Tables } from "@/integrations/supabase/types";
import { adminApi } from "@/lib/admin-api";

const adminModules = [
  {
    title: "Gestão de Equipe",
    description: "Gerencie perfis, cargos e status de colaboradores.",
    icon: Users,
    to: "/admin/colaboradores",
    category: "Geral",
  },
  {
     title: "Dashboard Folgas",
    description: "Visão geral e estatísticas do sistema de folgas.",
    icon: Shield,
    to: "/admin/folgas",
    category: "Folgas",
  },
  {
    title: "Calendário Geral",
    description: "Visão consolidada de todas as folgas da equipe.",
    icon: Calendar,
    to: "/admin/calendario",
    category: "Folgas",
  },
  {
    title: "Solicitações Especiais",
    description: "Gerencie pedidos de folgas fora das regras normais.",
    icon: ClipboardList,
    to: "/admin/solicitacoes",
    category: "Folgas",
  },
  {
    title: "Aprovações",
    description: "Aprove ou rejeite folgas pendentes e prioridades de aniversário.",
    icon: UserCheck,
    to: "/admin/aprovacoes",
    category: "Folgas",
  },
  {
    title: "Trocas de Folga",
    description: "Monitore e gerencie as solicitações de troca entre colaboradores.",
    icon: ArrowLeftRight,
    to: "/admin/trocas",
    category: "Folgas",
  },
  {
    title: "Datas Bloqueadas",
    description: "Configure e gerencie dias de bloqueio de folgas.",
    icon: Ban,
    to: "/admin/bloqueios",
    category: "Folgas",
  },
  {
    title: "Contracheques",
    description: "Faça upload e gerencie contracheques.",
    icon: FileText,
    to: "/admin/documentos",
    category: "Documentos",
  },
  {
    title: "Folhas de Ponto",
    description: "Faça upload e gerencie folhas de ponto.",
    icon: FileText,
    to: "/admin/documentos/ponto",
    category: "Documentos",
  },
  {
    title: "Atestados",
    description: "Gerencie e aprove atestados médicos.",
    icon: FileWarning,
    to: "/admin/documentos/atestados",
    category: "Documentos",
  },
  {
    title: "Registros Disciplinares",
    description: "Cadastre advertências e suspensões.",
    icon: ShieldAlert,
    to: "/admin/documentos/disciplinar",
    category: "Documentos",
  },
];

const blankEditForm = {
  nome: "", cpf: "", matricula: "", email: "", whatsapp: "",
  cargo: "", unidade_id: "", folga_fixa_semana: "",
  data_nascimento: "", data_admissao: "", perfil_acesso: "colaborador",
  ativo: true,
  senha: "",
};

export default function AdminHomeAdminPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [cargos, setCargos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroUnidade, setFiltroUnidade] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroCargo, setFiltroCargo] = useState("all");

  // New Dialog
  const [openNewDialog, setOpenNewDialog] = useState(false);
  const [newForm, setNewForm] = useState(blankEditForm);
  // Edit Dialog
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [editForm, setEditForm] = useState(blankEditForm);
  // Delete Confirmation
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  // Reset Password
  const [resetPasswordDialog, setResetPasswordDialog] = useState<{ profile: any; senha: string; confirmar: string } | null>(null);

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
        dataAdmissao: newForm.data_admissao,
        dataNascimento: newForm.data_nascimento,
        folgaFixaSemana: newForm.folga_fixa_semana === "" ? null : Number(newForm.folga_fixa_semana),
        role: newForm.perfil_acesso,
      });

      if (authErr) throw authErr;

      // Update profile with additional fields
      const { error: profErr } = await supabase.from("profiles").update({
        matricula: newForm.matricula.trim() || null,
        whatsapp: newForm.whatsapp.trim() || null,
        unidade_id: newForm.unidade_id === "" ? null : newForm.unidade_id,
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

  const openEdit = (p: any) => {
    setEditingProfile(p);
    setEditForm({
      nome: p.nome,
      cpf: formatCPF(p.cpf),
      matricula: p.matricula ?? "",
      email: p.email ?? "",
      whatsapp: p.whatsapp ?? "",
      cargo: p.cargo,
      unidade_id: p.unidade_id ?? "",
      folga_fixa_semana: p.folga_fixa_semana?.toString() ?? "",
      data_nascimento: p.data_nascimento ?? "",
      data_admissao: p.data_admissao ?? "",
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

      // Update profile
      const { error: profErr } = await supabase.from("profiles").update({
        nome: editForm.nome.trim(),
        cpf: cleanCpf,
        matricula: editForm.matricula.trim() || null,
        email: editForm.email.trim() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        cargo: editForm.cargo,
        unidade_id: editForm.unidade_id === "" ? null : editForm.unidade_id,
        folga_fixa_semana: editForm.folga_fixa_semana === "" ? null : Number(editForm.folga_fixa_semana),
        data_nascimento: editForm.data_nascimento || null,
        data_admissao: editForm.data_admissao || null,
        ativo: editForm.ativo,
        updated_at: new Date().toISOString(),
      }).eq("id", editingProfile.id);

      if (profErr) throw profErr;

      // Update role if changed
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

  const openResetPassword = (p: any) => {
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

  const groupedModules = adminModules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof adminModules>);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Shield className="size-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Acesso rápido aos módulos de gestão.</p>
      </div>

      {Object.entries(groupedModules).map(([category, modules]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-yellow-500 pb-1 text-red-600">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => (
              <a
                key={module.to}
                href={module.to}
                className="block h-full"
              >
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-primary/50 border-2 transition-all duration-200">
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="text-lg font-semibold text-primary">{module.title}</div>
                    <module.icon className="size-6 text-yellow-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Dialogs for quick collaborator management from dashboard */}
      <Dialog open={openNewDialog} onOpenChange={setOpenNewDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" className="justify-start gap-2" onClick={() => { setNewForm(blankEditForm); setOpenNewDialog(true); }}>
            <Plus className="size-4" /> Novo Colaborador
          </Button>
        </DialogTrigger>
        <ColaboradorFormDialog
          open={openNewDialog}
          onOpenChange={setOpenNewDialog}
          form={newForm}
          setForm={setNewForm}
          unidades={unidades}
          cargos={cargos}
          busy={busy}
          onSave={handleCreate}
          title="Novo Colaborador"
          isEdit={false}
        />
      </Dialog>

      <ColaboradorFormDialog
        open={!!editingProfile}
        onOpenChange={(open) => { if (!open) setEditingProfile(null); }}
        form={editForm}
        setForm={setEditForm}
        unidades={unidades}
        cargos={cargos}
        busy={busy}
        onSave={handleUpdate}
        title="Editar Colaborador"
        isEdit={true}
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