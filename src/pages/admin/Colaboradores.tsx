import { useEffect, useState, useMemo } from "react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Users, Pencil, Trash2, KeyRound, Cake, CalendarDays, RefreshCw, Shield, Search, ArrowUpDown } from "lucide-react";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { adminApi } from "@/lib/admin-api";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAY_OPTIONS = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda" },
  { value: "2", label: "Terça" },
  { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" },
  { value: "5", label: "Sexta" },
  { value: "6", label: "Sábado" },
];

type Cargo = Tables<'cargos'>;
type Unidade = Tables<'unidades'>;

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
  unidade_id: string | null;
  unidade_nome?: string; // Para exibição
  role?: string;
  created_at: string;
}

const blankForm = {
  nome: "",
  cpf: "",
  cargo: "",
  unidadeId: "", // Novo campo
  senha: "",
  dataAdmissao: "",
  dataNascimento: "",
  folgaFixa: "",
};

export default function Colaboradores() {
  const [list, setList] = useState<Profile[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "", cargo: "", unidadeId: "", dataAdmissao: "", dataDemissao: "", dataNascimento: "", folgaFixa: "",
  });
  const [resetting, setResetting] = useState<Profile | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  // Estados de Filtro
  const [filterName, setFilterName] = useState("");
  const [filterCargo, setFilterCargo] = useState("all");
  const [filterUnidade, setFilterUnidade] = useState("all");
  const [filterFolga, setFilterFolga] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Estados de Ordenação
  const [sortBy, setSortBy] = useState<keyof Profile | 'unidade_nome'>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const loadData = async () => {
    const [profResult, rolesResult, cargosResult, unidadesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, cpf, cargo, ativo, aprovacao_status, data_admissao, data_demissao, data_nascimento, folga_fixa_semana, unidade_id, created_at")
        .order("nome"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("cargos").select("nome").order("nome"),
      supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
    ]);

    const roleMap = new Map((rolesResult.data ?? []).map(r => [r.user_id, r.role]));
    const unidadeMap = new Map((unidadesResult.data ?? []).map(u => [u.id, u.nome]));
    
    setUnidades(unidadesResult.data as Unidade[]);
    setCargos(cargosResult.data as Cargo[]);

    const combined = (profResult.data ?? []).map(p => ({
      ...p,
      unidade_nome: p.unidade_id ? unidadeMap.get(p.unidade_id) : "Não Atribuída",
      role: roleMap.get(p.id) || "funcionario"
    }));
    setList(combined as Profile[]);

    // Define valores iniciais para o formulário se houver dados
    if (cargosResult.data && cargosResult.data.length > 0 && form.cargo === "") {
      setForm(prev => ({ ...prev, cargo: cargosResult.data[0].nome }));
    }
    if (unidadesResult.data && unidadesResult.data.length > 0 && form.unidadeId === "") {
      setForm(prev => ({ ...prev, unidadeId: unidadesResult.data[0].id }));
    }
  };

  useEffect(() => { loadData(); }, []);

  const create = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (!form.cargo.trim()) return toast.error("Selecione o cargo");
    if (!form.unidadeId.trim()) return toast.error("Selecione a unidade de trabalho");
    if (!isValidCPFLength(form.cpf)) return toast.error("CPF inválido");
    if (form.senha.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    setBusy(true);
    try {
      await adminApi.createUser({
        nome: form.nome.trim(),
        cpf: onlyDigits(form.cpf),
        cargo: form.cargo.trim(),
        unidadeId: form.unidadeId, // Novo campo
        senha: form.senha,
        dataAdmissao: form.dataAdmissao || null,
        dataNascimento: form.dataNascimento || null,
        folgaFixaSemana: form.folgaFixa === "" ? null : Number(form.folgaFixa),
        role: "funcionario",
      });
      toast.success("Colaborador cadastrado");
      setOpen(false);
      setForm(blankForm);
      loadData();
    } catch (e) {
      toast.error("Erro ao cadastrar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const syncAccess = async (p: Profile) => {
    const tempPassword = Math.random().toString(36).slice(-8);
    const toastId = toast.loading(`Sincronizando acesso de ${p.nome}...`);
    try {
      await adminApi.createUser({
        nome: p.nome,
        cpf: onlyDigits(p.cpf),
        cargo: p.cargo,
        unidadeId: p.unidade_id, // Incluindo unidade no sync
        senha: tempPassword,
        dataAdmissao: p.data_admissao,
        dataNascimento: p.data_nascimento,
        folgaFixaSemana: p.folga_fixa_semana,
        role: p.role,
      });
      toast.success("Acesso sincronizado!", {
        id: toastId,
        duration: 10000,
        description: `Nova senha temporária: ${tempPassword}. Informe ao colaborador.`
      });
      loadData();
    } catch (e) {
      toast.error("Erro na sincronização", { id: toastId, description: (e as Error).message });
    }
  };

  const openEdit = (p: Profile) => {
    setEditing(p);
    setEditForm({
      nome: p.nome,
      cargo: p.cargo,
      unidadeId: p.unidade_id ?? "", // Novo campo
      dataAdmissao: p.data_admissao ?? "",
      dataDemissao: p.data_demissao ?? "",
      dataNascimento: p.data_nascimento ?? "",
      folgaFixa: p.folga_fixa_semana == null ? "" : String(p.folga_fixa_semana),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.cargo.trim()) return toast.error("Selecione o cargo");
    if (!editForm.unidadeId.trim()) return toast.error("Selecione a unidade de trabalho");

    const { error } = await supabase
      .from("profiles")
      .update({
        nome: editForm.nome.trim(),
        cargo: editForm.cargo.trim(),
        unidade_id: editForm.unidadeId || null, // Novo campo
        data_admissao: editForm.dataAdmissao || null,
        data_demissao: editForm.dataDemissao || null,
        data_nascimento: editForm.dataNascimento || null,
        folga_fixa_semana: editForm.folgaFixa === "" ? null : Number(editForm.folgaFixa),
      })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Dados atualizados");
    setEditing(null);
    loadData();
  };

  const toggleAtivo = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return toast.error(error.message);
    loadData();
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
      toast.success("Colaborador excluído");
      setConfirmDelete(null);
      loadData();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSort = (key: keyof Profile | 'unidade_nome') => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const filteredAndSortedList = useMemo(() => {
    let filtered = list;

    // 1. Filtragem
    if (filterName) {
      filtered = filtered.filter(p => p.nome.toLowerCase().includes(filterName.toLowerCase()));
    }
    if (filterCargo !== "all") {
      filtered = filtered.filter(p => p.cargo === filterCargo);
    }
    if (filterUnidade !== "all") {
      filtered = filtered.filter(p => p.unidade_id === filterUnidade);
    }
    if (filterFolga !== "all") {
      const folgaNum = Number(filterFolga);
      filtered = filtered.filter(p => p.folga_fixa_semana === folgaNum);
    }
    if (filterStatus !== "all") {
      const statusBool = filterStatus === "ativo";
      filtered = filtered.filter(p => p.ativo === statusBool);
    }

    // 2. Ordenação
    return filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof Profile] ?? (sortBy === 'unidade_nome' ? a.unidade_nome : '');
      const bValue = b[sortBy as keyof Profile] ?? (sortBy === 'unidade_nome' ? b.unidade_nome : '');

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDir === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === "asc" ? aValue - bValue : bValue - aValue;
      }
      // Fallback para outros tipos ou nulos
      return 0;
    });
  }, [list, filterName, filterCargo, filterUnidade, filterFolga, filterStatus, sortBy, sortDir]);

  const SortButton = ({ columnKey, label }: { columnKey: keyof Profile | 'unidade_nome', label: string }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(columnKey)}
    >
      {label}
      <ArrowUpDown className={cn("size-3 transition-transform", sortBy === columnKey ? "text-primary" : "text-muted-foreground/50")} />
    </button>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" /> Colaboradores
          </h1>
          <p className="text-muted-foreground mt-1">Cadastre e gerencie a equipe.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Novo Colaborador</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: João Silva" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })} maxLength={14} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Select value={form.cargo} onValueChange={(value) => setForm({ ...form, cargo: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos.map((c) => (
                        <SelectItem key={c.nome} value={c.nome}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unidade de Trabalho</Label>
                <Select value={form.unidadeId} onValueChange={(value) => setForm({ ...form, unidadeId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <select className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm" value={form.folgaFixa} onChange={(e) => setForm({ ...form, folgaFixa: e.target.value })}>
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

      {/* Barra de Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Search className="size-4" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Filtro Nome */}
          <Input 
            placeholder="Filtrar por nome..." 
            value={filterName} 
            onChange={(e) => setFilterName(e.target.value)} 
            className="col-span-2 md:col-span-1"
          />
          
          {/* Filtro Cargo */}
          <Select value={filterCargo} onValueChange={setFilterCargo}>
            <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Cargos</SelectItem>
              {cargos.map((c) => <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Filtro Unidade */}
          <Select value={filterUnidade} onValueChange={setFilterUnidade}>
            <SelectTrigger><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              <SelectItem value="null">Não Atribuída</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro Folga Semanal */}
          <Select value={filterFolga} onValueChange={setFilterFolga}>
            <SelectTrigger><SelectValue placeholder="Folga Semanal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Folgas</SelectItem>
              {WEEKDAY_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Filtro Status */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">
                  <SortButton columnKey="nome" label="Colaborador" />
                </th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">
                  <SortButton columnKey="cargo" label="Cargo" />
                </th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">
                  <SortButton columnKey="unidade_nome" label="Unidade" />
                </th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">
                  <SortButton columnKey="folga_fixa_semana" label="Folga Semanal" />
                </th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSortedList.length === 0 && (
                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">Nenhum colaborador encontrado com os filtros aplicados.</td></tr>
              )}
              {filteredAndSortedList.map((p) => (
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
                  <td className="p-4 hidden md:table-cell"><span className="text-muted-foreground">{p.cargo}</span></td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className="text-muted-foreground">{p.unidade_nome}</span>
                  </td>
                  <td className="p-4">
                    {p.folga_fixa_semana != null ? (
                      <div className="flex items-center gap-1.5 font-bold text-blue-600">
                        <CalendarDays className="size-3" />
                        {WEEKDAYS[p.folga_fixa_semana]}
                      </div>
                    ) : <span className="text-muted-foreground/40">—</span>}
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
                      <Button variant="ghost" size="icon" className="size-8" title="Excluir" onClick={() => setConfirmDelete(p)}>
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
          <DialogHeader><DialogTitle>Editar colaborador</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={editForm.cargo} onValueChange={(value) => setEditForm({ ...editForm, cargo: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargos.map((c) => (
                    <SelectItem key={c.nome} value={c.nome}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade de Trabalho</Label>
              <Select value={editForm.unidadeId} onValueChange={(value) => setEditForm({ ...editForm, unidadeId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              <select className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm" value={editForm.folgaFixa} onChange={(e) => setEditForm({ ...editForm, folgaFixa: e.target.value })}>
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

      <Dialog open={!!resetting} onOpenChange={(o) => { if (!o) { setResetting(null); setNewPwd(""); } }}>
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