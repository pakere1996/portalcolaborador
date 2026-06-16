import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tables } from "@/integrations/supabase/types";
import { formatCPF, onlyDigits, isValidCPFLength } from "@/lib/cpf";
import { formatPhone } from "@/lib/utils";

type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;

interface ColaboradorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: {
    nome: string;
    cpf: string;
    matricula: string;
    email: string;
    whatsapp: string;
    cargo: string;
    unidadeId: string;
    folgaFixa: string;
    dataNascimento: string;
    dataAdmissao: string;
    perfil_acesso: string;
    ativo: boolean;
    senha: string;
  };
  setForm: (form: any) => void;
  unidades: Unidade[];
  cargos: Cargo[];
  busy: boolean;
  isEdit: boolean;
  onSave: () => void;
  title?: string;
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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
  title = "Colaborador",
}: ColaboradorFormDialogProps) {
  const handleFormChange = (id: string, value: string | boolean) => {
    setForm((prev: any) => {
      let newValue = value;
      
      if (id === 'cpf' && typeof value === 'string') {
        const rawValue = onlyDigits(value);
        if (rawValue.length > 11) return prev;
        newValue = formatCPF(rawValue);
      } else if (id === 'whatsapp' && typeof value === 'string') {
        newValue = formatPhone(value);
      }

      return { ...prev, [id]: newValue };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo *</Label>
              <Input 
                id="nome" 
                value={form.nome} 
                onChange={(e) => handleFormChange('nome', e.target.value)} 
                placeholder="Nome completo"
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
                disabled={busy || isEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="matricula">Matrícula</Label>
              <Input 
                id="matricula" 
                value={form.matricula} 
                onChange={(e) => handleFormChange('matricula', e.target.value)} 
                placeholder="Ex: 12345"
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
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
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input 
                id="whatsapp" 
                value={form.whatsapp} 
                onChange={(e) => handleFormChange('whatsapp', e.target.value)} 
                placeholder="(00) 00000-0000"
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select 
                value={form.cargo} 
                onValueChange={(value) => handleFormChange('cargo', value)}
                disabled={busy}
              >
                <SelectTrigger id="cargo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {cargos.map(c => (
                    <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidadeId">Unidade</Label>
              <Select 
                value={form.unidadeId} 
                onValueChange={(value) => handleFormChange('unidadeId', value)}
                disabled={busy}
              >
                <SelectTrigger id="unidadeId">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="folgaFixa">Folga Fixa</Label>
              <Select 
                value={form.folgaFixa} 
                onValueChange={(value) => handleFormChange('folgaFixa', value)}
                disabled={busy}
              >
                <SelectTrigger id="folgaFixa">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {WEEKDAYS.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input 
                id="dataNascimento" 
                type="date"
                value={form.dataNascimento} 
                onChange={(e) => handleFormChange('dataNascimento', e.target.value)} 
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataAdmissao">Data de Admissão</Label>
              <Input 
                id="dataAdmissao" 
                type="date"
                value={form.dataAdmissao} 
                onChange={(e) => handleFormChange('dataAdmissao', e.target.value)} 
                disabled={busy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="perfil_acesso">Perfil de Acesso</Label>
              <Select 
                value={form.perfil_acesso} 
                onValueChange={(value) => handleFormChange('perfil_acesso', value)}
                disabled={busy}
              >
                <SelectTrigger id="perfil_acesso">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                id="ativo" 
                checked={form.ativo} 
                onCheckedChange={(checked) => handleFormChange('ativo', checked)} 
                disabled={busy}
              />
              <Label htmlFor="ativo">Colaborador Ativo</Label>
            </div>
          )}

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="senha">Senha (opcional)</Label>
              <Input 
                id="senha" 
                type="password"
                value={form.senha} 
                onChange={(e) => handleFormChange('senha', e.target.value)} 
                placeholder="Deixe em branco para usar CPF como senha"
                disabled={busy}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}</arg_value>
<dyad-write path="src/components/ColaboradorFormDialog.tsx" description="Complete the ColaboradorFormDialog component">
  );
}