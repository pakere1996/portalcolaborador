import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Plus,
  Building2,
  Pencil,
  Trash2,
  ListChecks,
  Users,
  X,
  Save,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FavoritarBotao } from "@/components/FavoritarBotao";

// Tipos (use as tabelas do seu projeto)
type Unidade = {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  ativo: boolean;
  possui_relogio_ponto: boolean;
  tem_adiantamento: boolean;
  dia_adiantamento: number | null;
  created_at: string;
};

type Sindicato = {
  id: string;
  nome: string;
  tipo: "laboral" | "patronal";
};

type Cargo = {
  id: string;
  nome: string;
  descricao: string | null;
};

interface UnidadeWithCounts extends Unidade {
  cargos_count?: number;
  sindicatos_patronais_count?: number;
}

interface UnidadeCargoAssoc {
  cargo_id: string;
  sindicato_laboral_id: string | null;
  cargo_nome?: string;
}

const blank = {
  nome: "",
  cnpj: "",
  endereco: "",
  cidade: "",
  telefone: "",
  possui_relogio_ponto: false,
  tem_adiantamento: false,
  dia_adiantamento: null as number | null,
};

export default function Unidades() {
  const [list, setList] = useState<UnidadeWithCounts[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [editForm, setEditForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState<Unidade | null>(null);

  // Dados auxiliares
  const [sindicatosPatronais, setSindicatosPatronais] = useState<Sindicato[]>(
    []
  );
  const [sindicatosLaborais, setSindicatosLaborais] = useState<Sindicato[]>([]);
  const [cargosGlobais, setCargosGlobais] = useState<Cargo[]>([]);

  // Associações para a unidade em edição
  const [patronaisSelecionados, setPatronaisSelecionados] = useState<string[]>(
    []
  );
  const [cargosAssociados, setCargosAssociados] = useState<
    UnidadeCargoAssoc[]
  >([]);

  // Novo cargo a ser adicionado
  const [novoCargoId, setNovoCargoId] = useState<string>("");
  const [novoCargoSindicatoId, setNovoCargoSindicatoId] =
    useState<string>("none");

  // Estados para criação rápida
  const [openNovoCargo, setOpenNovoCargo] = useState(false);
  const [openNovoSindicato, setOpenNovoSindicato] = useState(false);
  const [novoCargoForm, setNovoCargoForm] = useState({ nome: "", descricao: "" });
  const [novoSindicatoForm, setNovoSindicatoForm] = useState({
    nome: "",
    tipo: "laboral" as "laboral" | "patronal",
  });

  // Carregar listagem principal
  const load = async () => {
    const { data: unidades, error } = await supabase
      .from("unidades")
      .select("*")
      .order("nome");
    if (error) {
      toast.error(error.message);
      return;
    }

    // Buscar contagens separadamente
    const unidadesComContagens = await Promise.all(
      (unidades ?? []).map(async (u) => {
        const { count: patronalCount } = await supabase
          .from("sindicato_unidades")
          .select("*", { count: "exact", head: true })
          .eq("unidade_id", u.id);
        const { count: cargoCount } = await supabase
          .from("unidade_cargos")
          .select("*", { count: "exact", head: true })
          .eq("unidade_id", u.id);
        return {
          ...u,
          sindicatos_patronais_count: patronalCount || 0,
          cargos_count: cargoCount || 0,
        };
      })
    );
    setList(unidadesComContagens);
  };

  // Carregar dados auxiliares (sindicatos e cargos)
  const loadAuxData = async () => {
    const { data: patronais } = await supabase
      .from("sindicatos")
      .select("*")
      .eq("tipo", "patronal")
      .order("nome");
    if (patronais) setSindicatosPatronais(patronais);

    const { data: laborais } = await supabase
      .from("sindicatos")
      .select("*")
      .eq("tipo", "laboral")
      .order("nome");
    if (laborais) setSindicatosLaborais(laborais);

    const { data: cargos } = await supabase
      .from("cargos")
      .select("*")
      .order("nome");
    if (cargos) setCargosGlobais(cargos);
  };

  useEffect(() => {
    load();
    loadAuxData();
  }, []);

  // Abrir edição e carregar associações
  const openEdit = async (u: Unidade) => {
    setEditing(u);
    setEditForm({
      nome: u.nome,
      cnpj: u.cnpj ?? "",
      endereco: u.endereco ?? "",
      cidade: u.cidade ?? "",
      telefone: u.telefone ?? "",
      possui_relogio_ponto: u.possui_relogio_ponto ?? false,
      tem_adiantamento: u.tem_adiantamento ?? false,
      dia_adiantamento: u.dia_adiantamento ?? null,
    });

    // Carregar sindicatos patronais
    const { data: su } = await supabase
      .from("sindicato_unidades")
      .select("sindicato_id")
      .eq("unidade_id", u.id);
    setPatronaisSelecionados(su?.map((item) => item.sindicato_id) ?? []);

    // Carregar cargos associados
    const { data: uc } = await supabase
      .from("unidade_cargos")
      .select("cargo_id, sindicato_laboral_id")
      .eq("unidade_id", u.id);
    const assoc = (uc ?? []).map((item) => {
      const cargo = cargosGlobais.find((c) => c.id === item.cargo_id);
      return {
        cargo_id: item.cargo_id,
        sindicato_laboral_id: item.sindicato_laboral_id,
        cargo_nome: cargo?.nome || "Cargo removido",
      };
    });
    setCargosAssociados(assoc);
    setNovoCargoId("");
    setNovoCargoSindicatoId("none");
  };

  // Adicionar cargo à lista local
  const addCargo = () => {
    if (!novoCargoId) {
      toast.warning("Selecione um cargo.");
      return;
    }
    if (cargosAssociados.some((a) => a.cargo_id === novoCargoId)) {
      toast.warning("Este cargo já está associado a esta unidade.");
      return;
    }
    const cargo = cargosGlobais.find((c) => c.id === novoCargoId);
    setCargosAssociados([
      ...cargosAssociados,
      {
        cargo_id: novoCargoId,
        sindicato_laboral_id:
          novoCargoSindicatoId === "none" ? null : novoCargoSindicatoId,
        cargo_nome: cargo?.nome || "Cargo",
      },
    ]);
    setNovoCargoId("");
    setNovoCargoSindicatoId("none");
  };

  const removeCargo = (cargoId: string) => {
    setCargosAssociados(
      cargosAssociados.filter((a) => a.cargo_id !== cargoId)
    );
  };

  const updateCargoSindicato = (cargoId: string, value: string) => {
    const sindicatoId = value === "none" ? null : value;
    setCargosAssociados(
      cargosAssociados.map((a) =>
        a.cargo_id === cargoId ? { ...a, sindicato_laboral_id: sindicatoId } : a
      )
    );
  };

  const togglePatronal = (sindicatoId: string) => {
    setPatronaisSelecionados((prev) =>
      prev.includes(sindicatoId)
        ? prev.filter((id) => id !== sindicatoId)
        : [...prev, sindicatoId]
    );
  };

  // Criação rápida de novo cargo
  const criarNovoCargo = async () => {
    if (!novoCargoForm.nome.trim()) {
      toast.error("Nome do cargo é obrigatório.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("cargos")
        .insert({
          nome: novoCargoForm.nome.trim(),
          descricao: novoCargoForm.descricao.trim() || null,
        })
        .select();
      if (error) throw error;
      toast.success("Cargo criado com sucesso!");
      setOpenNovoCargo(false);
      setNovoCargoForm({ nome: "", descricao: "" });
      await loadAuxData();
      if (data && data[0]) {
        setNovoCargoId(data[0].id);
      }
    } catch (e: any) {
      toast.error("Erro ao criar cargo", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  // Criação rápida de novo sindicato
  const criarNovoSindicato = async () => {
    if (!novoSindicatoForm.nome.trim()) {
      toast.error("Nome do sindicato é obrigatório.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("sindicatos")
        .insert({
          nome: novoSindicatoForm.nome.trim(),
          tipo: novoSindicatoForm.tipo,
        })
        .select();
      if (error) throw error;
      toast.success("Sindicato criado com sucesso!");
      setOpenNovoSindicato(false);
      setNovoSindicatoForm({ nome: "", tipo: "laboral" });
      await loadAuxData();
      // Se for laboral e estiver no contexto de adicionar cargo, pré-selecionar
      if (novoSindicatoForm.tipo === "laboral" && data && data[0]) {
        setNovoCargoSindicatoId(data[0].id);
      }
    } catch (e: any) {
      toast.error("Erro ao criar sindicato", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  // Salvar edição (unidade + associações)
  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.nome.trim()) {
      toast.error("O nome da unidade é obrigatório.");
      return;
    }
    setBusy(true);
    try {
      // 1. Atualizar dados da unidade
      const { error: updateError } = await supabase
        .from("unidades")
        .update({
          nome: editForm.nome.trim(),
          cnpj: editForm.cnpj.trim() || null,
          endereco: editForm.endereco.trim() || null,
          cidade: editForm.cidade.trim() || null,
          telefone: editForm.telefone.trim() || null,
          possui_relogio_ponto: editForm.possui_relogio_ponto || false,
          tem_adiantamento: editForm.tem_adiantamento || false,
          dia_adiantamento: editForm.tem_adiantamento
            ? editForm.dia_adiantamento
            : null,
        })
        .eq("id", editing.id);
      if (updateError) throw updateError;

      // 2. Atualizar sindicatos patronais (deleta todos e insere os selecionados)
      const { error: delPatronal } = await supabase
        .from("sindicato_unidades")
        .delete()
        .eq("unidade_id", editing.id);
      if (delPatronal) throw delPatronal;

      if (patronaisSelecionados.length > 0) {
        const { error: insPatronal } = await supabase
          .from("sindicato_unidades")
          .insert(
            patronaisSelecionados.map((sindicato_id) => ({
              unidade_id: editing.id,
              sindicato_id,
            }))
          );
        if (insPatronal) throw insPatronal;
      }

      // 3. Atualizar cargos (deleta todos e insere os novos)
      const { error: delCargos } = await supabase
        .from("unidade_cargos")
        .delete()
        .eq("unidade_id", editing.id);
      if (delCargos) throw delCargos;

      if (cargosAssociados.length > 0) {
        const { error: insCargos } = await supabase
          .from("unidade_cargos")
          .insert(
            cargosAssociados.map(({ cargo_id, sindicato_laboral_id }) => ({
              unidade_id: editing.id,
              cargo_id,
              sindicato_laboral_id,
            }))
          );
        if (insCargos) throw insCargos;
      }

      toast.success("Unidade atualizada com sucesso!");
      setEditing(null);
      load();
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes("row-level security")) {
        toast.error("Erro de permissão (RLS). Verifique se você é administrador.");
      } else {
        toast.error("Erro ao atualizar", { description: e.message });
      }
    } finally {
      setBusy(false);
    }
  };

  // Criar nova unidade
  const create = async () => {
    if (!form.nome.trim()) return toast.error("Informe o nome da unidade");
    setBusy(true);
    try {
      const { error } = await supabase.from("unidades").insert({
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        endereco: form.endereco.trim() || null,
        cidade: form.cidade.trim() || null,
        telefone: form.telefone.trim() || null,
        ativo: true,
        possui_relogio_ponto: form.possui_relogio_ponto || false,
        tem_adiantamento: form.tem_adiantamento || false,
        dia_adiantamento: form.tem_adiantamento ? form.dia_adiantamento : null,
      });
      if (error) throw error;
      toast.success("Unidade cadastrada!");
      setOpen(false);
      setForm(blank);
      load();
    } catch (e: any) {
      toast.error("Erro ao cadastrar", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const toggleAtivo = async (u: Unidade) => {
    const { error } = await supabase
      .from("unidades")
      .update({ ativo: !u.ativo })
      .eq("id", u.id);
    if (error) return toast.error(error.message);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("unidades")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Unidade excluída!");
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    } finally {
      setBusy(false);
    }
  };

  // ---------- Renderização ----------
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Unidades
          </h1>
          <p className="text-muted-foreground mt-1">
            Cadastre e gerencie as unidades, seus cargos e sindicatos patronais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FavoritarBotao
            rota="/admin/unidades"
            label="Unidades"
            icone="Building2"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full px-6">
                <Plus className="size-4 mr-2" /> Nova Unidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova unidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* ... campos iguais aos anteriores ... */}
                <div className="space-y-2">
                  <Label>Nome da Unidade *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Pakerê Garavelo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={form.endereco}
                    onChange={(e) =>
                      setForm({ ...form, endereco: e.target.value })
                    }
                    placeholder="Ex: R 9 A, SN"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input
                    value={form.cidade}
                    onChange={(e) =>
                      setForm({ ...form, cidade: e.target.value })
                    }
                    placeholder="Ex: Aparecida de Goiânia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) =>
                      setForm({ ...form, telefone: e.target.value })
                    }
                    placeholder="Ex: (62) 99999-9999"
                  />
                </div>
                <div className="flex items-center space-x-2 rounded-xl border border-border p-3">
                  <Switch
                    id="possui_relogio_ponto"
                    checked={form.possui_relogio_ponto || false}
                    onCheckedChange={(checked) =>
                      setForm({ ...form, possui_relogio_ponto: checked })
                    }
                  />
                  <Label htmlFor="possui_relogio_ponto">
                    Possui relógio de ponto
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rounded-xl border border-border p-3">
                  <Switch
                    id="tem_adiantamento"
                    checked={form.tem_adiantamento || false}
                    onCheckedChange={(checked) =>
                      setForm({
                        ...form,
                        tem_adiantamento: checked,
                        dia_adiantamento: checked ? form.dia_adiantamento : null,
                      })
                    }
                  />
                  <Label htmlFor="tem_adiantamento">
                    Tem adiantamento salarial
                  </Label>
                </div>
                {form.tem_adiantamento && (
                  <div className="space-y-2">
                    <Label>Dia do Adiantamento</Label>
                    <Select
                      value={form.dia_adiantamento?.toString() || ""}
                      onValueChange={(value) =>
                        setForm({ ...form, dia_adiantamento: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o dia" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(
                          (dia) => (
                            <SelectItem key={dia} value={dia.toString()}>
                              {dia}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={create} disabled={busy}>
                  {busy ? "Salvando..." : "Cadastrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabela de unidades */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">
                  Unidade
                </th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">
                  CNPJ
                </th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">
                  Cargos
                </th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">
                  Sind. Patronais
                </th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">
                  Status
                </th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-12 text-center text-muted-foreground"
                  >
                    Nenhuma unidade cadastrada.
                  </td>
                </tr>
              )}
              {list.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-muted/20 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-bold">{u.nome}</div>
                    {u.endereco && (
                      <div className="text-xs text-muted-foreground">
                        {u.endereco}
                      </div>
                    )}
                  </td>
                  <td className="p-4 hidden md:table-cell font-mono text-xs">
                    {u.cnpj || "—"}
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <ListChecks className="size-3" /> {u.cargos_count ?? 0}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      <Users className="size-3" />{" "}
                      {u.sindicatos_patronais_count ?? 0}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <Switch
                      checked={u.ativo}
                      onCheckedChange={() => toggleAtivo(u)}
                    />
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(u)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setConfirmDelete(u)}
                      >
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

      {/* Modal de edição */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar unidade: {editing?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Dados básicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={editForm.nome}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={editForm.cnpj}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cnpj: e.target.value })
                  }
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={editForm.endereco}
                  onChange={(e) =>
                    setEditForm({ ...editForm, endereco: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={editForm.cidade}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cidade: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={editForm.telefone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, telefone: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center space-x-2 rounded-xl border border-border p-3 col-span-full">
                <Switch
                  id="edit_possui_relogio_ponto"
                  checked={editForm.possui_relogio_ponto || false}
                  onCheckedChange={(checked) =>
                    setEditForm({ ...editForm, possui_relogio_ponto: checked })
                  }
                />
                <Label htmlFor="edit_possui_relogio_ponto">
                  Possui relógio de ponto
                </Label>
              </div>
              <div className="flex items-center space-x-2 rounded-xl border border-border p-3 col-span-full">
                <Switch
                  id="edit_tem_adiantamento"
                  checked={editForm.tem_adiantamento || false}
                  onCheckedChange={(checked) =>
                    setEditForm({
                      ...editForm,
                      tem_adiantamento: checked,
                      dia_adiantamento: checked
                        ? editForm.dia_adiantamento
                        : null,
                    })
                  }
                />
                <Label htmlFor="edit_tem_adiantamento">
                  Tem adiantamento salarial
                </Label>
              </div>
              {editForm.tem_adiantamento && (
                <div className="space-y-2 col-span-full">
                  <Label>Dia do Adiantamento</Label>
                  <Select
                    value={editForm.dia_adiantamento?.toString() || ""}
                    onValueChange={(value) =>
                      setEditForm({
                        ...editForm,
                        dia_adiantamento: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o dia" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(
                        (dia) => (
                          <SelectItem key={dia} value={dia.toString()}>
                            {dia}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <hr className="border-border" />

            {/* Seção: Sindicatos Patronais */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Users className="size-5" /> Sindicatos Patronais
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNovoSindicatoForm({ nome: "", tipo: "patronal" });
                    setOpenNovoSindicato(true);
                  }}
                >
                  <Plus className="size-4 mr-1" /> Novo Patronal
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Selecione os sindicatos patronais que representam esta unidade.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {sindicatosPatronais.map((s) => (
                  <div key={s.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`patronal-${s.id}`}
                      checked={patronaisSelecionados.includes(s.id)}
                      onChange={() => togglePatronal(s.id)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor={`patronal-${s.id}`} className="text-sm">
                      {s.nome}
                    </Label>
                  </div>
                ))}
                {sindicatosPatronais.length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">
                    Nenhum sindicato patronal cadastrado.
                  </p>
                )}
              </div>
            </div>

            <hr className="border-border" />

            {/* Seção: Cargos da Unidade */}
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ListChecks className="size-5" /> Cargos da Unidade
              </h3>
              <p className="text-sm text-muted-foreground">
                Associe cargos a esta unidade e defina o sindicato laboral para
                cada um.
              </p>

              {/* Lista de cargos já associados */}
              <div className="mt-4 space-y-2">
                {cargosAssociados.map((assoc) => (
                  <div
                    key={assoc.cargo_id}
                    className="flex items-center gap-3 p-2 border border-border rounded-md bg-muted/10"
                  >
                    <span className="font-medium min-w-[120px]">
                      {assoc.cargo_nome}
                    </span>
                    <div className="flex-1">
                      <Select
                        value={assoc.sindicato_laboral_id || "none"}
                        onValueChange={(value) =>
                          updateCargoSindicato(assoc.cargo_id, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sindicato laboral (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {sindicatosLaborais.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive"
                      onClick={() => removeCargo(assoc.cargo_id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                {cargosAssociados.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum cargo associado.
                  </p>
                )}
              </div>

              {/* Adicionar novo cargo */}
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs">Cargo</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={novoCargoId}
                      onValueChange={setNovoCargoId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione um cargo" />
                      </SelectTrigger>
                      <SelectContent>
                        {cargosGlobais.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      onClick={() => setOpenNovoCargo(true)}
                      title="Novo cargo"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-xs">Sindicato Laboral</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={novoCargoSindicatoId}
                      onValueChange={setNovoCargoSindicatoId}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Opcional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {sindicatosLaborais.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      onClick={() => {
                        setNovoSindicatoForm({ nome: "", tipo: "laboral" });
                        setOpenNovoSindicato(true);
                      }}
                      title="Novo sindicato laboral"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={addCargo}
                  disabled={!novoCargoId}
                >
                  <Plus className="size-4 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={busy}>
              {busy ? (
                "Salvando..."
              ) : (
                <>
                  <Save className="size-4 mr-2" /> Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de criação rápida de novo cargo */}
      <Dialog open={openNovoCargo} onOpenChange={setOpenNovoCargo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Cargo *</Label>
              <Input
                value={novoCargoForm.nome}
                onChange={(e) =>
                  setNovoCargoForm({ ...novoCargoForm, nome: e.target.value })
                }
                placeholder="Ex: Pizzaiolo Sênior"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={novoCargoForm.descricao}
                onChange={(e) =>
                  setNovoCargoForm({ ...novoCargoForm, descricao: e.target.value })
                }
                placeholder="Breve descrição"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNovoCargo(false)}>
              Cancelar
            </Button>
            <Button onClick={criarNovoCargo} disabled={busy}>
              {busy ? "Criando..." : "Criar Cargo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de criação rápida de novo sindicato */}
      <Dialog open={openNovoSindicato} onOpenChange={setOpenNovoSindicato}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Sindicato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Sindicato *</Label>
              <Input
                value={novoSindicatoForm.nome}
                onChange={(e) =>
                  setNovoSindicatoForm({
                    ...novoSindicatoForm,
                    nome: e.target.value,
                  })
                }
                placeholder="Ex: Sindicato dos Pizzaiolos"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={novoSindicatoForm.tipo}
                onValueChange={(value: "laboral" | "patronal") =>
                  setNovoSindicatoForm({ ...novoSindicatoForm, tipo: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="laboral">Laboral</SelectItem>
                  <SelectItem value="patronal">Patronal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenNovoSindicato(false)}>
              Cancelar
            </Button>
            <Button onClick={criarNovoSindicato} disabled={busy}>
              {busy ? "Criando..." : "Criar Sindicato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmação de exclusão */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Colaboradores vinculados a esta
              unidade perderão o vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={busy}
            >
              {busy ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}