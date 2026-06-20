import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { maskCNPJ } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

type Unidade = Tables<"unidades">;
type Cargo = Tables<"cargos">;

interface ColaboradorForm {
  nome: string;
  cpf: string;
  matricula: string;
  email: string;
  whatsapp: string;
  cargo: string;
  unidadeId: string;
  folgaFixa: string;
  dataAdmissao: string;
  dataNascimento: string;
  perfil_acesso: string;
  regime_trabalho: string;
  ativo: boolean;
  senha: string;
  data_demissao: string;
  tipo_vinculo: string; // 🔥 NOVO
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  form: ColaboradorForm;
  setForm: (form: ColaboradorForm) => void;
  unidades: Unidade[];
  cargos: Cargo[];
  busy: boolean;
  isEdit: boolean;
  onSave: () => void;
}

const DIAS_SEMANA = [
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

export function ColaboradorFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  unidades,
  cargos,
  busy,
  isEdit,
  onSave,
}: ColaboradorFormDialogProps) {
  const set = (field: keyof ColaboradorForm) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm({ ...form, [field]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Colaborador" : "Novo Colaborador"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={form.nome} onChange={set("nome")} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={form.cpf} onChange={set("cpf")} placeholder="000.000.000-00" disabled={isEdit} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cargo *</Label>
              {cargos.length > 0 ? (
                <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map((c) => (
                      <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.cargo} onChange={set("cargo")} placeholder="Ex: Atendente" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Matrícula (Opcional)</Label>
              <Input value={form.matricula} onChange={set("matricula")} placeholder="Matrícula" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={form.unidadeId} onValueChange={(v) => setForm({ ...form, unidadeId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}{u.cnpj ? ` — ${maskCNPJ(u.cnpj)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Folga Fixa Semanal</Label>
              <Select value={form.folgaFixa} onValueChange={(v) => setForm({ ...form, folgaFixa: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Regime de Trabalho</Label>
              <Select value={form.regime_trabalho} onValueChange={(v) => setForm({ ...form, regime_trabalho: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  <SelectItem value="Horista">Horista</SelectItem>
                  <SelectItem value="Mensalista">Mensalista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={form.perfil_acesso} onValueChange={(v) => setForm({ ...form, perfil_acesso: v })}>
                <SelectTrigger>
                  <SelectValue />
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
              <Label>Data de Admissão</Label>
              <Input type="date" value={form.dataAdmissao} onChange={set("dataAdmissao")} />
            </div>
            <div className="space-y-2">
              <Label>Data de Nascimento</Label>
              <Input type="date" value={form.dataNascimento} onChange={set("dataNascimento")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Demissão</Label>
              <Input 
                type="date" 
                value={form.data_demissao} 
                onChange={set("data_demissao")}
                min={form.dataAdmissao || undefined}
              />
              <p className="text-xs text-muted-foreground">Preencha se já desligado.</p>
            </div>
            <div className="space-y-2">
              <Label>Email de Contato</Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="email@exemplo.com" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={set("whatsapp")} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Vínculo</Label>
              <Select value={form.tipo_vinculo} onValueChange={(v) => setForm({ ...form, tipo_vinculo: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLT">Colaborador CLT</SelectItem>
                  <SelectItem value="Socio">Sócio (Pró-labore)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Senha Inicial</Label>
              <Input
                type="password"
                value={form.senha}
                onChange={set("senha")}
                placeholder="Deixe vazio para usar os 6 últimos dígitos do CPF"
              />
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-3 rounded-xl border border-border p-4">
              <Switch
                checked={form.ativo}
                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
              />
              <Label>Colaborador Ativo</Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Colaborador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ColaboradorFormDialog;