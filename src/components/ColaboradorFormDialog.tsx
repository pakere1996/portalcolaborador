import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCPF } from "@/lib/cpf";

interface Unidade {
  id: string;
  nome: string;
  possui_relogio_ponto?: boolean;
  tem_adiantamento?: boolean;
  dia_adiantamento?: number | null;
}

interface Cargo {
  id: string;
  nome: string;
}

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: any;
  setForm: (form: any) => void;
  unidades: Unidade[];
  cargos: Cargo[];
  busy: boolean;
  isEdit: boolean;
  onSave: () => void;
}

const DIAS_SEMANA = [
  { value: "none", label: "Nenhuma" },
  { value: "0", label: "Domingo" },
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
];

const REGIMES = [
  { value: "none", label: "Não informado" },
  { value: "CLT", label: "CLT" },
  { value: "Estatutário", label: "Estatutário" },
  { value: "PJ", label: "Pessoa Jurídica" },
  { value: "Autônomo", label: "Autônomo" },
  { value: "Estagiário", label: "Estagiário" },
  { value: "Temporário", label: "Temporário" },
];

const TIPOS_VINCULO = [
  { value: "CLT", label: "CLT" },
  { value: "Socio", label: "Sócio" },
  { value: "Estagiario", label: "Estagiário" },
  { value: "PJ", label: "PJ" },
  { value: "Autonomo", label: "Autônomo" },
  { value: "Temporario", label: "Temporário" },
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
  // 🔥 Quando a unidade mudar, podemos pré-definir a flag de adiantamento
  // baseado na configuração da unidade (opcional)
  useEffect(() => {
    if (form.unidadeId && form.unidadeId !== "none") {
      const unidade = unidades.find((u) => u.id === form.unidadeId);
      if (unidade) {
        // Se a unidade tem adiantamento e o campo ainda não foi definido,
        // podemos pré-marcar como true (opcional)
        // Mas deixamos o usuário decidir individualmente
        if (unidade.tem_adiantamento && form.optante_adiantamento === undefined) {
          setForm({ ...form, optante_adiantamento: true });
        }
      }
    }
  }, [form.unidadeId, unidades, setForm, form]);

  const unidadeSelecionada = unidades.find((u) => u.id === form.unidadeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Linha 1: Nome */}
          <div className="col-span-2 space-y-2">
            <Label>Nome Completo *</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: João da Silva"
            />
          </div>

          {/* Linha 2: CPF e Matrícula */}
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
              placeholder="000.000.000-00"
              maxLength={14}
            />
          </div>
          <div className="space-y-2">
            <Label>Matrícula</Label>
            <Input
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              placeholder="Ex: 1234"
            />
          </div>

          {/* Linha 3: Email e WhatsApp */}
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@exemplo.com"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="(62) 99999-9999"
            />
          </div>

          {/* Linha 4: Cargo e Unidade */}
          <div className="space-y-2">
            <Label>Cargo *</Label>
            <Select
              value={form.cargo}
              onValueChange={(value) => setForm({ ...form, cargo: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo" />
              </SelectTrigger>
              <SelectContent>
                {cargos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Unidade *</Label>
            <Select
              value={form.unidadeId}
              onValueChange={(value) => setForm({ ...form, unidadeId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 5: Datas */}
          <div className="space-y-2">
            <Label>Data de Admissão *</Label>
            <Input
              type="date"
              value={form.dataAdmissao}
              onChange={(e) => setForm({ ...form, dataAdmissao: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de Nascimento *</Label>
            <Input
              type="date"
              value={form.dataNascimento}
              onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })}
            />
          </div>

          {/* Linha 6: Regime, Vínculo e Folga Fixa */}
          <div className="space-y-2">
            <Label>Regime de Trabalho</Label>
            <Select
              value={form.regime_trabalho || "none"}
              onValueChange={(value) => setForm({ ...form, regime_trabalho: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {REGIMES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo de Vínculo</Label>
            <Select
              value={form.tipo_vinculo || "CLT"}
              onValueChange={(value) => setForm({ ...form, tipo_vinculo: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_VINCULO.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Folga Fixa Semanal</Label>
            <Select
              value={form.folgaFixa || "none"}
              onValueChange={(value) => setForm({ ...form, folgaFixa: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma" />
              </SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Linha 7: Perfil e Status */}
          <div className="space-y-2">
            <Label>Perfil de Acesso</Label>
            <Select
              value={form.perfil_acesso || "colaborador"}
              onValueChange={(value) => setForm({ ...form, perfil_acesso: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 rounded-xl border border-border p-3 self-end">
            <Switch
              id="ativo"
              checked={form.ativo !== undefined ? form.ativo : true}
              onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
            />
            <Label htmlFor="ativo">Ativo</Label>
          </div>

          {/* Linha 8: Folha de Ponto (só aparece se a unidade tiver relógio de ponto) */}
          {unidadeSelecionada?.possui_relogio_ponto && (
            <div className="col-span-2 flex items-center space-x-2 rounded-xl border border-border p-3">
              <Switch
                id="possui_folha_ponto"
                checked={form.possui_folha_ponto || false}
                onCheckedChange={(checked) => setForm({ ...form, possui_folha_ponto: checked })}
              />
              <Label htmlFor="possui_folha_ponto">Possui Folha de Ponto</Label>
            </div>
          )}

          {/* 🔥 NOVO: Optante por Adiantamento */}
          <div className="col-span-2 flex items-center space-x-2 rounded-xl border border-border p-3">
            <Switch
              id="optante_adiantamento"
              checked={form.optante_adiantamento || false}
              onCheckedChange={(checked) => setForm({ ...form, optante_adiantamento: checked })}
            />
            <Label htmlFor="optante_adiantamento">Opta por Adiantamento Salarial</Label>
            {unidadeSelecionada?.tem_adiantamento && unidadeSelecionada?.dia_adiantamento && (
              <span className="text-xs text-muted-foreground ml-auto">
                Dia do adiantamento: {unidadeSelecionada.dia_adiantamento}
              </span>
            )}
          </div>

          {/* Linha 9: Senha (apenas para novo colaborador) */}
          {!isEdit && (
            <div className="col-span-2 space-y-2">
              <Label className="flex items-center justify-between">
                <span>Senha Inicial</span>
                {form.cpf && (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Sugerida: {form.cpf.replace(/\D/g, "").slice(-6)}
                  </span>
                )}
              </Label>
              <Input
                type="text"
                placeholder="Padrão: 6 últimos dígitos do CPF"
                value={form.senha || ""}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                className="font-mono bg-muted/30"
              />
            </div>
          )}

          {/* Linha extra: Data de Demissão (se inativo) */}
          {!form.ativo && (
            <div className="col-span-2 space-y-2">
              <Label>Data de Demissão</Label>
              <Input
                type="date"
                value={form.dataDemissao || ""}
                onChange={(e) => setForm({ ...form, dataDemissao: e.target.value })}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : isEdit ? "Atualizar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}