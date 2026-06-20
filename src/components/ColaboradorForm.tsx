import React, { useEffect, useRef } from "react";
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

const getCargoOptions = (cargos: Cargo[]): string[] => {
  const nomes = cargos.map(c => c.nome.trim().toUpperCase());
  if (!nomes.includes("SÓCIO")) {
    nomes.push("SÓCIO");
  }
  return nomes.sort();
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

  const cargoOptions = getCargoOptions(cargos);

  // Referência para guardar o ID da unidade anterior, para detectar mudanças
  const prevUnidadeIdRef = useRef<string | null>(null);

  // 🔥 Efeito para controlar o switch baseado na unidade selecionada
  useEffect(() => {
    const unidadeId = form.unidadeId; // ← agora usa unidadeId (camelCase)
    // Se não houver unidade selecionada ou for "none" ou vazio, desabilita e desmarca
    if (!unidadeId || unidadeId === 'none' || unidadeId === '') {
      setForm((prev: any) => ({ ...prev, possui_folha_ponto: false }));
      prevUnidadeIdRef.current = unidadeId;
      return;
    }

    const unidadeSelecionada = unidades.find(u => u.id === unidadeId);
    if (!unidadeSelecionada) {
      setForm((prev: any) => ({ ...prev, possui_folha_ponto: false }));
      prevUnidadeIdRef.current = unidadeId;
      return;
    }

    const temRelogio = unidadeSelecionada.possui_relogio_ponto || false;

    // Se a unidade NÃO tem relógio, força false e desabilita
    if (!temRelogio) {
      setForm((prev: any) => ({ ...prev, possui_folha_ponto: false }));
    } else {
      // Unidade tem relógio
      // Se for criação (isEdit = false), ativa automaticamente
      // Se for edição, só ativa se a unidade mudou e era diferente
      const unidadeMudou = prevUnidadeIdRef.current !== unidadeId;
      if (!isEdit || unidadeMudou) {
        setForm((prev: any) => ({ ...prev, possui_folha_ponto: true }));
      }
      // Se for edição e a unidade não mudou, mantém o valor atual (não sobrescreve)
    }

    // Atualiza a referência da unidade anterior
    prevUnidadeIdRef.current = unidadeId;
  }, [form.unidadeId, unidades, isEdit, setForm]);

  // 🔥 Determina se a unidade tem relógio para habilitar/desabilitar o switch
  const unidadeSelecionada = unidades.find(u => u.id === form.unidadeId);
  const unidadeTemRelogio = unidadeSelecionada?.possui_relogio_ponto || false;
  const isSwitchDisabled = busy || !unidadeTemRelogio || !form.unidadeId || form.unidadeId === 'none' || form.unidadeId === '';

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
              {cargoOptions.map(cargoNome => (
                <SelectItem key={cargoNome} value={cargoNome}>{cargoNome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unidadeId">Unidade *</Label>
          <Select 
            value={form.unidadeId || "none"} 
            onValueChange={(value) => handleFormChange('unidadeId', value)}
            disabled={busy}
          >
            <SelectTrigger id="unidadeId">
              <SelectValue placeholder="Selecione a Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem Unidade</SelectItem>
              {unidades.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipo_vinculo">Tipo de Vínculo</Label>
          <Select 
            value={form.tipo_vinculo || "CLT"} 
            onValueChange={(value) => handleFormChange('tipo_vinculo', value)}
            disabled={busy}
          >
            <SelectTrigger id="tipo_vinculo">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CLT">Colaborador CLT</SelectItem>
              <SelectItem value="Socio">Sócio (Pró-labore)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="regime_trabalho">Regime de Trabalho</Label>
          <Select 
            value={form.regime_trabalho || "none"} 
            onValueChange={(value) => handleFormChange('regime_trabalho', value)}
            disabled={busy}
          >
            <SelectTrigger id="regime_trabalho">
              <SelectValue placeholder="Selecione o Regime" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não informado</SelectItem>
              <SelectItem value="Horista">Horista</SelectItem>
              <SelectItem value="Mensalista">Mensalista</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="folgaFixa">Folga Fixa Semanal *</Label>
          <Select 
            value={form.folgaFixa || "none"} 
            onValueChange={(value) => handleFormChange('folgaFixa', value)}
            disabled={busy}
          >
            <SelectTrigger id="folgaFixa">
              <SelectValue placeholder="Nenhuma Folga Fixa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma Folga Fixa</SelectItem>
              {Object.entries(dayOfWeekMap).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
          <p className="text-xs text-muted-foreground">Preencha apenas se o colaborador já foi desligado.</p>
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

      {/* 🔥 Switch para Folha de Ponto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center space-x-2 rounded-xl border border-border p-3">
          <Switch 
            id="possui_folha_ponto" 
            checked={form.possui_folha_ponto || false} 
            onCheckedChange={(checked) => handleFormChange('possui_folha_ponto', checked)} 
            disabled={isSwitchDisabled}
          />
          <Label htmlFor="possui_folha_ponto" className={isSwitchDisabled ? "text-muted-foreground" : ""}>
            Possui acesso a Folha de Ponto
            {isSwitchDisabled && !busy && (
              <span className="ml-1 text-xs text-muted-foreground">
                {!form.unidadeId || form.unidadeId === 'none' 
                  ? "(selecione uma unidade)" 
                  : "(unidade sem relógio)"}
              </span>
            )}
          </Label>
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