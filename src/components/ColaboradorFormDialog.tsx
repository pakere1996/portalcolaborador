import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CARGOS = ["Administrador", "Atendente", "Pizzaiolo", "Motoqueiro"];

interface ColaboradorForm {
  nome: string;
  cpf: string;
  cargo: string;
  senha: string;
  dataAdmissao: string;
  dataNascimento: string;
  folgaFixa: string;
  unidadeId: string;
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ColaboradorForm;
  setForm: (form: ColaboradorForm) => void;
  busy: boolean;
  onSave: () => void;
  unidades: { id: string; nome: string; cnpj: string | null }[];
  title?: string;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  busy,
  onSave,
  unidades,
  title = "Novo Colaborador",
}: ColaboradorFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <select
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              >
                <option value="">Selecione...</option>
                {CARGOS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Unidade *</Label>
            <select
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
              value={form.unidadeId}
              onChange={(e) => setForm({ ...form, unidadeId: e.target.value })}
            >
              <option value="">Selecione a unidade...</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}{u.cnpj ? ` - ${u.cnpj}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={form.dataNascimento}
                onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Admissão</Label>
              <Input
                type="date"
                value={form.dataAdmissao}
                onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Folga Semanal</Label>
            <select
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
              value={form.folgaFixa}
              onChange={(e) => setForm({ ...form, folgaFixa: e.target.value })}
            >
              <option value="">— Sem folga semanal —</option>
              {WEEKDAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Senha Inicial *</Label>
            <Input
              type="password"
              value={form.senha}
              onChange={(e) => setForm({ ...form, senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}