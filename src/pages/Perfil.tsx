"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserCircle, Save, MapPin, Mail, Phone, Cake, CalendarDays, ShieldAlert } from "lucide-react";
import { formatCPF } from "@/lib/cpf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HistoricoDisciplinar from "@/components/HistoricoDisciplinar";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function DadosPessoaisTab({ profile, busy, setBusy, form, setForm, handleSave, refresh }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border">
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Nome</Label>
          <div className="font-semibold">{profile.nome}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">CPF</Label>
          <div className="font-mono">{formatCPF(profile.cpf)}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Cargo</Label>
          <div className="text-sm">{profile.cargo}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase">Data de Admissão</Label>
          <div className="text-sm">
            {profile.data_admissao ? new Date(profile.data_admissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
            <Cake className="size-3 text-amber-500" /> Data de Nascimento
          </Label>
          <div className="text-sm">
            {profile.data_nascimento ? new Date(profile.data_nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
            <CalendarDays className="size-3 text-blue-500" /> Folga Semanal
          </Label>
          <div className="text-sm font-medium text-blue-600">
            {profile.folga_fixa_semana != null ? WEEKDAYS[profile.folga_fixa_semana] : "Não definida"}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" /> E-mail de Contato
          </Label>
          <Input
            id="email"
            type="email"
            value={form.email_contato}
            onChange={(e) => setForm({ ...form, email_contato: e.target.value })}
            placeholder="seu.email@exemplo.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="whatsapp" className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" /> WhatsApp
          </Label>
          <Input
            id="whatsapp"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endereco" className="flex items-center gap-2">
            <MapPin className="size-4 text-muted-foreground" /> Endereço Completo
          </Label>
          <Textarea
            id="endereco"
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            placeholder="Rua, número, bairro, cidade..."
            rows={3}
          />
        </div>

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Salvando..." : (
            <>
              <Save className="size-4 mr-2" /> Salvar Alterações
            </>
          )}
        </Button>
      </form>
    </div>
  );
}


export default function PerfilPage() {
  const { profile, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    endereco: "",
    email_contato: "",
    whatsapp: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        endereco: profile.endereco ?? "",
        email_contato: profile.email_contato ?? "",
        whatsapp: profile.whatsapp ?? "",
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        endereco: form.endereco.trim(),
        email_contato: form.email_contato.trim(),
        whatsapp: form.whatsapp.trim(),
      })
      .eq("id", profile.id);

    setBusy(false);

    if (error) {
      toast.error("Erro ao atualizar dados", { description: error.message });
      return;
    }

    toast.success("Dados atualizados com sucesso!");
    refresh();
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <UserCircle className="size-6 text-primary" /> Perfil do Colaborador
        </h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações e visualize seu histórico.</p>
      </div>

      <Tabs defaultValue="dados-pessoais" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="dados-pessoais">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="historico-disciplinar" className="flex items-center gap-1">
            <ShieldAlert className="size-4" /> Disciplinar
          </TabsTrigger>
        </TabsList>
        
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl mt-4">
          <TabsContent value="dados-pessoais">
            <DadosPessoaisTab 
              profile={profile} 
              busy={busy} 
              setBusy={setBusy} 
              form={form} 
              setForm={setForm} 
              handleSave={handleSave} 
              refresh={refresh} 
            />
          </TabsContent>
          
          <TabsContent value="historico-disciplinar">
            <HistoricoDisciplinar />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}