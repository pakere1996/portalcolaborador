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
import { Plus, Building2, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { cn, formatPhone, onlyDigits } from "@/lib/utils";

type Unidade = Tables<'unidades'>;

const blankForm = {
  nome: "",
  endereco: "",
  cidade: "",
  telefone: "", // Armazena o valor formatado para exibição no input
  ativo: true,
};

export default function Unidades() {
  const [list, setList] = useState<Unidade[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Unidade | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .order("nome");
    
    if (error) {
      console.error("Erro ao carregar unidades:", error);
      toast.error("Erro ao carregar unidades.");
      return;
    }
    setList(data);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.nome.trim()) return toast.error("O nome da unidade é obrigatório.");
    setBusy(true);
    
    const rawTelefone = onlyDigits(form.telefone);

    try {
      const { error } = await supabase
        .from("unidades")
        .insert({ 
          nome: form.nome.trim(), 
          endereco: form.endereco.trim() || null,
          cidade: form.cidade.trim() || null,
          telefone: rawTelefone || null, // Salva apenas dígitos
          ativo: form.ativo,
        });
      
      if (error) {
        if (error.code === '23505') { // Unique violation
          return toast.error("Erro", { description: "Já existe uma unidade com este nome." });
        }
        throw error;
      }

      toast.success("Unidade cadastrada com sucesso.");
      setOpen(false);
      setForm(blankForm);
      load();
    } catch (e) {
      toast.error("Erro ao cadastrar", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (unidade: Unidade) => {
    setEditing(unidade);
    setForm({ 
      nome: unidade.nome, 
      endereco: unidade.endereco || "", 
      cidade: unidade.cidade || "", 
      telefone: unidade.telefone ? formatPhone(unidade.telefone) : "", // Formata para exibição
      ativo: unidade.ativo,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!form.nome.trim()) return toast.error("O nome da unidade é obrigatório.");
    setBusy(true);

    const rawTelefone = onlyDigits(form.telefone);

    try {
      const { error } = await supabase
        .from("unidades")
        .update({ 
          nome: form.nome.trim(), 
          endereco: form.endereco.trim() || null,
          cidade: form.cidade.trim() || null,
          telefone: rawTelefone || null, // Salva apenas dígitos
          ativo: form.ativo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);

      if (error) {
        if (error.code === '23505') { // Unique violation
          return toast.error("Erro", { description: "Já existe uma unidade com este nome." });
        }
        throw error;
      }

      toast.success("Unidade atualizada com sucesso.");
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
        .from("unidades")
        .delete()
        .eq("id", confirmDelete.id);

      if (error) {
        throw error;
      }

      toast.success("Unidade excluída.");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error("Erro ao excluir", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    
    if (id === 'telefone') {
      // Aplica a máscara no estado do formulário
      const formattedValue = formatPhone(value);
      setForm({ ...form, [id]: formattedValue });
    } else {
      setForm({ ...form, [id]: value });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Unidades
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie as unidades/filiais da empresa.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Nova Unidade</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Unidade</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Unidade</Label>
                <Input id="nome" value={form.nome} onChange={handleFormChange} placeholder="Ex: Matriz Centro" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input id="endereco" value={form.endereco} onChange={handleFormChange} placeholder="Rua Exemplo, 123" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" value={form.cidade} onChange={handleFormChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input 
                    id="telefone" 
                    value={form.telefone} 
                    onChange={handleFormChange} 
                    placeholder="(99) 99999-9999" 
                    maxLength={15} // (XX) XXXXX-XXXX
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch 
                  id="ativo" 
                  checked={form.ativo} 
                  onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} 
                />
                <Label htmlFor="ativo">Unidade Ativa</Label>
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
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px]">Unidade</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden lg:table-cell">Localização</th>
                <th className="text-left p-4 font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Telefone</th>
                <th className="text-center p-4 font-bold uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-right p-4 font-bold uppercase tracking-wider text-[10px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">Nenhuma unidade cadastrada.</td></tr>
              )}
              {list.map((unidade) => (
                <tr key={unidade.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-4 font-medium">{unidade.nome}</td>
                  <td className="p-4 hidden lg:table-cell text-muted-foreground">
                    {unidade.endereco} {unidade.cidade && `(${unidade.cidade})`}
                  </td>
                  <td className="p-4 hidden md:table-cell text-muted-foreground">
                    {unidade.telefone ? formatPhone(unidade.telefone) : "—"}
                  </td>
                  <td className="p-4 text-center">
                    <div className={cn("flex items-center justify-center gap-1", unidade.ativo ? "text-green-600" : "text-red-600")}>
                      {unidade.ativo ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
                      <span className="hidden sm:inline">{unidade.ativo ? "Ativa" : "Inativa"}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => openEdit(unidade)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" title="Excluir" onClick={() => setConfirmDelete(unidade)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Unidade: {editing?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Unidade</Label>
              <Input id="nome" value={form.nome} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" value={form.endereco} onChange={handleFormChange} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={form.cidade} onChange={handleFormChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input 
                  id="telefone" 
                  value={form.telefone} 
                  onChange={handleFormChange} 
                  maxLength={15}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="ativo" 
                checked={form.ativo} 
                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} 
              />
              <Label htmlFor="ativo">Unidade Ativa</Label>
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
            <AlertDialogTitle>Excluir Unidade: {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a unidade "{confirmDelete?.nome}"? Esta ação não pode ser desfeita.
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