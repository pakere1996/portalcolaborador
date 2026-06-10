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
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

const blank = {
  nome: "", cnpj: "", endereco: "", cidade: "", telefone: "",
};

export default function Unidades() {
  const [list, setList] = useState<Unidade[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [editForm, setEditForm] = useState(blank);
  const [confirmDelete, setConfirmDelete] = useState<Unidade | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .order("nome");
    if (error) toast.error(error.message);
    else setList(data ?? []);
  };

  useEffect(() => { load(); }, []);

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
      });
      if (error) throw error;
      toast.success("Unidade cadastrada!");
      setOpen(false);
      setForm(blank);
      load();
    } catch (e) {
      toast.error("Erro ao cadastrar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (u: Unidade) => {
    setEditing(u);
    setEditForm({
      nome: u.nome,
      cnpj: u.cnpj ?? "",
      endereco: u.endereco ?? "",
      cidade: u.cidade ?? "",
      telefone: u.telefone ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("unidades").update({
      nome: editForm.nome.trim(),
      cnpj: editForm.cnpj.trim() || null,
      endereco: editForm.endereco.trim() || null,
      cidade: editForm.cidade.trim() || null,
      telefone: editForm.telefone.trim() || null,
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Unidade atualizada!");
    setEditing(null);
    load();
  };

  const toggleAtivo = async (u: Unidade) => {
    const { error } = await supabase.from("unidades").update({ ativo: !u.ativo }).eq("id", u.id);
    if (error) return toast.error(error.message);
    load();
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("unidades").delete().eq("id", confirmDelete.id);
    if (error) return toast.error(error.message);
    toast.success("Unidade excluída!");
    setConfirmDelete(null);
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Unidades
          </h1>
          <p className="text-muted-foreground mt-1">Cadastre e gerencie as unidades da loja.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Nova Unidade</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Unidade *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pakerê Garavelo" />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Ex: R 9 A, SN" />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Ex: Aparecida de Goiânia" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="Ex: (62) 99999-9999" />
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
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Unidade</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">CNPJ</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Cidade</th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">Nenhuma unidade cadastrada.</td></tr>
              )}
              {list.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4">
                    <div className="font-bold">{u.nome}</div>
                    {u.endereco && <div className="text-xs text-muted-foreground">{u.endereco}</div>}
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="font-mono text-xs">{u.cnpj || "—"}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className="text-muted-foreground">{u.cidade || "—"}</span>
                  </td>
                  <td className="p-4 text-center">
                    <Switch checked={u.ativo} onCheckedChange={() => toggleAtivo(u)} />
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(u)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setConfirmDelete(u)}>
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
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar unidade</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input value={editForm.cnpj} onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={editForm.endereco} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} /></div>
            <div className="space-y-2"><Label>Cidade</Label><Input value={editForm.cidade} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Colaboradores vinculados a esta unidade perderão o vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 text-white hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}