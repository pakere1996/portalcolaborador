import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminApi } from "@/lib/admin-api";
import { Tables } from "@/integrations/supabase/types";
import { formatCPF, onlyDigits } from "@/lib/cpf";

type Unidade = Tables<'unidades'>;
type Cargo = { nome: string };

interface NovoColaboradorDialogProps {
  unidades: Unidade[];
  cargos: Cargo[];
  onSuccess: () => void;
}

const dayOfWeekMap: Record<number, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
};

const blankForm = {
  nome: "",
  email: "",
  cpf: "",
  cargo: "",
  unidade_id: "null",
  folga_fixa_semana: "null",
};

export function NovoColaboradorDialog({ unidades, cargos, onSuccess }: NovoColaboradorDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [busy, setBusy] = useState(false);

  const handleFormChange = (id: keyof typeof blankForm, value: string) => {
    if (id === 'cpf') {
      const rawValue = onlyDigits(value);
      if (rawValue.length > 11) return;
      setForm({ ...form, [id]: formatCPF(rawValue) });
    } else {
      setForm({ ...form, [id]: value });
    }
  };

  const handleSubmit = async () => {
    if (!form.nome.trim() || !form.email.trim() || !form.cpf.trim() || !form.cargo.trim()) {
      return toast.error("Preencha todos os campos obrigatórios (Nome, E-mail, CPF e Cargo).");
    }
    if (onlyDigits(form.cpf).length !== 11) {
      return toast.error("CPF inválido.", { description: "O CPF deve conter 11 dígitos." });
    }

    setBusy(true);

    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim(),
      cpf: onlyDigits(form.cpf),
      cargo: form.cargo,
      unidade_id: form.unidade_id === "null" ? null : form.unidade_id,
      folga_fixa_semana: form.folga_fixa_semana === "null" ? null : Number(form.folga_fixa_semana),
    };

    try {
      // A Edge Function 'admin-users' com action 'create' cuida da criação do Auth user e do Profile
      await adminApi.createUser(payload);

      toast.success("Colaborador cadastrado com sucesso.", {
        description: "O usuário foi criado e receberá um e-mail para definir a senha.",
      });
      setOpen(false);
      setForm(blankForm);
      onSuccess();
    } catch (e) {
      toast.error("Erro ao cadastrar colaborador", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full px-6"><Plus className="size-4 mr-2" /> Novo Colaborador</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input 
              id="nome" 
              value={form.nome} 
              onChange={(e) => handleFormChange('nome', e.target.value)} 
              placeholder="Nome completo do colaborador"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input 
                id="email" 
                type="email"
                value={form.email} 
                onChange={(e) => handleFormChange('email', e.target.value)} 
                placeholder="email@empresa.com"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input 
                id="cpf" 
                value={form.cpf} 
                onChange={(e) => handleFormChange('cpf', e.target.value)} 
                placeholder="000.000.000-00"
                maxLength={14}
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Cargo */}
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo *</Label>
              <Select 
                value={form.cargo} 
                onValueChange={(value) => handleFormChange('cargo', value)}
                disabled={busy}
              >
                <SelectTrigger id="cargo">
                  <SelectValue placeholder="Selecione o Cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargos.map(c => (
                    <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unidade */}
            <div className="space-y-2">
              <Label htmlFor="unidade_id">Unidade</Label>
              <Select 
                value={form.unidade_id} 
                onValueChange={(value) => handleFormChange('unidade_id', value)}
                disabled={busy}
              >
                <SelectTrigger id="unidade_id">
                  <SelectValue placeholder="Sem Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Sem Unidade</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Folga Fixa */}
          <div className="space-y-2">
            <Label htmlFor="folga_fixa_semana">Folga Fixa Semanal</Label>
            <Select 
              value={form.folga_fixa_semana} 
              onValueChange={(value) => handleFormChange('folga_fixa_semana', value)}
              disabled={busy}
            >
              <SelectTrigger id="folga_fixa_semana">
                <SelectValue placeholder="Nenhuma Folga Fixa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhuma Folga Fixa</SelectItem>
                {Object.entries(dayOfWeekMap).map(([key, value]) => (
                  <SelectItem key={key} value={key}>{value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); setForm(blankForm); }} disabled={busy}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            {busy ? "Cadastrando..." : "Cadastrar Colaborador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}