import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tables } from "@/integrations/supabase/types";
import { formatCPF, onlyDigits } from "@/lib/cpf";
import { formatPhone } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

type Unidade = Tables<'unidades'>;
type Cargo = Tables<'cargos'>;

interface ColaboradorFormProps {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  unidades: Unidade[];
  cargos: Cargo[];
  busy: boolean;
  isEdit?: boolean;
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

export function ColaboradorForm({ form, setForm, unidades, cargos, busy, isEdit = false }: ColaboradorFormProps) {

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
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome Completo *</Label>
          <Input 
            id="nome" 
            value={form.nome || ""} 
            onChange={(e) => handleFormChange('nome', e.target.value)} 
            placeholder="Nome completo do colaborador"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpf">CPF *</Label>
          <Input 
            id="cpf" 
            value={form.cpf || ""} 
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
            value={form.matricula || ""} 
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
            value={form.email || ""} 
            onChange={(e) => handleFormChange('email', e.target.value)} 
            placeholder="email@empresa.com (Opcional)"
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">Telefone (WhatsApp)</Label>
          <Input 
            id="whatsapp" 
            value={form.whatsapp || ""} 
            onChange={(e) => handleFormChange('whatsapp', e.target.value)} 
            placeholder="(99) 99999-9999"
            maxLength={15}
            disabled={busy}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cargo">Cargo *</Label>
          <Select 
            value={form.cargo || ""} 
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

        <div className="space-y-2">
          <Label htmlFor="unidade_id">Unidade *</Label>
          <Select 
            value={form.unidade_id || "null"} 
            onValueChange={(value) => handleFormChange('unidade_id', value)}
            disabled={busy}
          >
            <SelectTrigger id="unidade_id">
              <SelectValue placeholder="Selecione a Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">Sem Unidade</SelectItem>
              {unidades.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="regime_trabalho">Regime de Trabalho</Label>
          <Select 
            value={form.regime_trabalho || "null"} 
            onValueChange={(value) => handleFormChange('regime_trabalho', value)}
            disabled={busy}
          >
            <SelectTrigger id="regime_trabalho">
              <SelectValue placeholder="Selecione o Regime" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">Não informado</SelectItem>
              <SelectItem value="Horista">Horista</SelectItem>
              <SelectItem value="Mensalista">Mensalista</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_nascimento">Data de Nascimento *</Label>
          <Input 
            id="data_nascimento" 
            type="date"
            value={form.data_nascimento || ""} 
            onChange={(e) => handleFormChange('data_nascimento', e.target.value)} 
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_admissao">Data de Admissão *</Label>
          <Input 
            id="data_admissao" 
            type="date"
            value={form.data_admissao || ""} 
            onChange={(e) => handleFormChange('data_admissao', e.target.value)} 
            disabled={busy}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="folga_fixa_semana">Folga Fixa Semanal *</Label>
          <Select 
            value={form.folga_fixa_semana || "null"} 
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

      {/* 🔥 NOVO CAMPO: Data de Demissão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_demissao">Data de Demissão</Label>
          <Input 
            id="data_demissao" 
            type="date"
            value={form.data_demissao || ""} 
            onChange={(e) => handleFormChange('data_demissao', e.target.value)} 
            min={form.data_admissao || undefined}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            Preencha apenas se o colaborador já foi desligado.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="perfil_acesso">Perfil de Acesso *</Label>
          <Select 
            value={form.perfil_acesso || "colaborador"} 
            onValueChange={(value) => handleFormChange('perfil_acesso', value)}
            disabled={busy}
          >
            <SelectTrigger id="perfil_acesso">
              <SelectValue placeholder="Colaborador (Padrão)" />
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
    </div>
  );
}