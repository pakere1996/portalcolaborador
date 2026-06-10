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
import { Plus, Briefcase, Pencil, Trash2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Cargo = Tables<'cargos'>;

const blankForm = {
  nome: "",
  descricao: "",
};

export default function Cargos() {
  const [list, setList] = useState<Cargo[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Cargo | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("cargos")
      .select("*")
      .order("nome");
    
    if (error) {
      console.error("Erro ao carregar cargos:", error);
      toast.error("Erro ao carregar cargos.");
      return;
    }
    setList(data);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.nome.trim()) return toast.error("O nome do cargo é obrigatório.");
    setBusy(true);
    try {
      const { error } = await supabase
        .from("cargos")
        .insert({ nome: form.nome.trim(), descricao: form.descricao.trim() || null });
      
      if (error) {
        if (error.code === '23505') { // Unique violation
          return toast.error("Erro", { description: "Já existe um cargo com este nome." });
        }
        throw error;
      }

      toast.success("Cargo cadastrado com sucesso.");
      setOpen(false);
      setForm(blankForm);
      load();
    } catch (e) {
      toast.error("Erro ao cadastrar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (cargo: Cargo) => {
    setEditing(cargo);
    setForm({ nome: cargo.nome, descricao: cargo.descricao || "" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.nome.trim()) return toast.error("O nome do cargo é obrigatório.");
    setBusy(true);

    try {
      const { error } = await supabase
        .from("cargos")
        .update({ 
          nome: form.nome.trim(), 
          descricao: form.descricao.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);

      if (error) {
        if (error.code === '23505') { // Unique violation
          return toast.error("Erro", { description: "Já existe um cargo com este nome." });
        }
        throw error;
      }

      toast.success("Cargo atualizado com sucesso.");
      setEditing(null);
      setForm(blankForm);
      load();
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
      const { error } = await supabase
        .from("cargos")
        .delete()
        .eq("id", confirmDelete.id);

      if (error) {
        // Check for foreign key constraint violation (if profiles reference this cargo)
        if (error.code === '23503') {
          return toast.error("Erro de exclusão", { description: "Este cargo está sendo usado por colaboradores e não pode ser excluído." });
        }
        throw error;
      }

      toast.success("Cargo excluído.");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error("Erro ao excluir", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Briefcase className="size-6 text-primary" /> Cargos
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os cargos disponíveis na empresa.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Novo Cargo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Cargo</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Cargo</Label>
                <Input id="nome" value={form.nome} onChange={handleFormChange} placeholder="Ex: Pizzaiolo Sênior" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição (Opcional)</Label>
                <textarea id="descricao" value={form.descricao} onChange={handleFormChange} rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Breve descrição das responsabilidades." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setOpen(false); setForm(blankForm); }}>Cancelar</Button>
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
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Nome</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Descrição</th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 && (
                <tr><td colSpan={3} className="p-12 text-center text-muted-foreground">Nenhum cargo cadastrado.</td></tr>
              )}
              {list.map((cargo) => (
                <tr key={cargo.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-medium">{cargo.nome}</td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">{cargo.descricao || "—"}</td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(cargo)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="Excluir" onClick={() => setConfirmDelete(cargo)}>
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

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setForm(blankForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Cargo: {editing?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Cargo</Label>
              <Input id="nome" value={form.nome} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição (Opcional)</Label>
              <textarea id="descricao" value={form.descricao} onChange={handleFormChange} rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditing(null); setForm(blankForm); }}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? "Salvando..." : "Salvar Alterações"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cargo: {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o cargo "{confirmDelete?.nome}"? Esta ação não pode ser desfeita.
              Se houver colaboradores vinculados, a exclusão será bloqueada.
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
    </div>
  );
}