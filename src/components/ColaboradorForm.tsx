import React, { useEffect } from "react";
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

  const prevUnidadeIdRef = React.useRef<string | null>(null);

  useEffect(() => {
    const unidadeId = form.unidadeId;
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

    if (!temRelogio) {
      setForm((prev: any) => ({ ...prev, possui_folha_ponto: false }));
    } else {
      const unidadeMudou = prevUnidadeIdRef.current !== unidadeId;
      if (!isEdit || unidadeMudou) {
        setForm((prev: any) => ({ ...prev, possui_folha_ponto: true }));
      }
    }

    prevUnidadeIdRef.current = unidadeId;
  }, [form.unidadeId, unidades, isEdit, setForm]);

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
            // 🔥 REMOVER disabled={busy || isEdit} – admin pode editar CPF
            disabled={busy}
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

      {/* ... resto do formulário (igualmente ao original) ... */}
    </div>
  );
}