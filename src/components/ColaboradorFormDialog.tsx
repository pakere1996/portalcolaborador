import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface ColaboradorForm {
  nome: string;
  cpf: string;
  cargo: string;
  senha: string;
  dataAdmissao: string;
  dataNascimento: string;
  folgaFixa: string;
  unidadeId: string;
  matricula: string;
  email: string;
  whatsapp: string;
  perfil_acesso: string;
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ColaboradorForm;
  setForm: React.Dispatch<React.SetStateAction<ColaboradorForm>>;
  busy: boolean;
  onSave: () => void;
  unidades: { id: string; nome: string; cnpj: string | null }[];
  cargos: { id: string; nome: string }[];
  title?: string;
  isEdit?: boolean;
}

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  busy,
  onSave,
  unidades,
  cargos,
  title = "Novo Colaborador",
  isEdit = false,
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
              onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: João Silva"
              disabled={busy}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input
                value={form.cpf}
                onChange={(e) => setForm(prev => ({ ...prev, cpf: e.target.value }))}
                placeholder="000.000.000-00"
                maxLength={14}
                disabled={busy || isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input
                value={form.matricula}
                onChange={(e) => setForm(prev => ({ ...prev, matricula: e.target.value }))}
                placeholder="Ex: 12345"
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Select
                value={form.cargo}
                onValueChange={(value) => setForm(prev => ({ ...prev, cargo: value }))}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o Cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargos.map(c => (
                    <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select
                value={form.unidadeId}
                onValueChange={(value) => setForm(prev => ({ ...prev, unidadeId: value }))}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem Unidade</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Nascimento *</Label>
              <Input
                type="date"
                value={form.dataNascimento}
                onChange={(e) => setForm(prev => ({ ...prev, dataNascimento: e.target.value }))}
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Admissão *</Label>
              <Input
                type="date"
                value={form.dataAdmissao}
                onChange={(e) => setForm(prev => ({ ...prev, dataAdmissao: e.target.value }))}
                disabled={busy}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Folga Fixa Semanal</Label>
              <Select
                value={form.folgaFixa}
                onValueChange={(value) => setForm(prev => ({ ...prev, folgaFixa: value }))}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {WEEKDAYS.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso *</Label>
              <Select
                value={form.perfil_acesso}
                onValueChange={(value) => setForm(prev => ({ ...prev, perfil_acesso: value }))}
                disabled={busy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Colaborador" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@empresa.com"
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="(99) 99999-9999"
                maxLength={15}
                disabled={busy}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Senha Inicial *</Label>
            <Input
              type="password"
              value={form.senha}
              onChange={(e) => setForm(prev => ({ ...prev, senha: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              disabled={busy}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : isEdit ? "Atualizar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}