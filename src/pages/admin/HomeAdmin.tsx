import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
    to: "/admin",
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
  // Edit Dialog
  const [editingProfile, setEditingProfile] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "", cpf: "", matricula: "", email: "", whatsapp: "",
    cargo: "", unidade_id: "null", folga_fixa_semana: "null",
    data_nascimento: "", data_admissao: "", perfil_acesso: "colaborador",
    ativo: true,
  });
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

  const handleCreate = async (formData: any) => {
    setBusy(true);
    try {
      const cleanCpf = onlyDigits(formData.cpf);
      if (!isValidCPFLength(cleanCpf)) throw new Error("CPF inválido");

      const { data: authUser, error: authErr } = await adminApi.createUser({
        nome: formData.nome.trim(),
        cpf: cleanCpf,
        email: formData.email.trim().toLowerCase() || `${cleanCpf}@pakere.com.br`,
        senha: formData.senha || cleanCpf.slice(-6),
        cargo: formData.cargo,
        dataAdmissao: formData.data_admissao,
        dataNascimento: formData.data_nascimento,
        folgaFixaSemana: formData.folga_fixa_semana === "null" ? null : Number(formData.folga_fixa_semana),
        role: formData.perfil_acesso,
      });

      if (authErr) throw authErr;

      // Update profile with additional fields
      const { error: profErr } = await supabase.from("profiles").update({
        matricula: formData.matricula.trim() || null,
        whatsapp: formData.whatsapp.trim() || null,
        unidade_id: formData.unidade_id === "null" ? null : formData.unidade_id,
        ativo: true,
      }).eq("id", authUser.userId);

      if (profErr) throw profErr;

      toast.success("Colaborador criado com sucesso!");
      setOpenNewDialog(false);
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
      unidade_id: p.unidade_id ?? "null",
      folga_fixa_semana: p.folga_fixa_semana?.toString() ?? "null",
      data_nascimento: p.data_nascimento ?? "",
      data_admissao: p.data_admissao ?? "",
      perfil_acesso: p.role ?? "colaborador",
      ativo: p.ativo,
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
        unidade_id: editForm.unidade_id === "null" ? null : editForm.unidade_id,
        folga_fixa_semana: editForm.folga_fixa_semana === "null" ? null : Number(editForm.folga_fixa_semana),
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
    </div>
  );
}