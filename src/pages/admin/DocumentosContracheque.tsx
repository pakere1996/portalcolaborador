"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Calendar,
  Users,
  Info,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { formatBR, parseYMD } from "@/lib/folga-rules";
import { Badge } from "@/components/ui/badge";

type Profile = Tables<'profiles'> & { tem_adiantamento_individual?: boolean };
type Unidade = Tables<'unidades'>;
type Contracheque = Tables<'contracheques'>;

export default function DocumentosContracheque() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [documentos, setDocumentos] = useState<Contracheque[]>([]);

  // Filtros
  const [filtroColaborador, setFiltroColaborador] = useState<string>("");
  const [filtroMes, setFiltroMes] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "mensal" | "adiantamento">("todos");

  // Formulário de upload
  const [selectedColaborador, setSelectedColaborador] = useState<string>("");
  const [selectedTipo, setSelectedTipo] = useState<"mensal" | "adiantamento">("mensal");
  const [selectedMes, setSelectedMes] = useState<string>("");
  const [selectedQuinzena, setSelectedQuinzena] = useState<1 | 2 | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, u, c] = await Promise.all([
        supabase.from("profiles").select("*").eq("ativo", true).order("nome"),
        supabase.from("unidades").select("*").order("nome"),
        supabase.from("contracheques").select("*").order("created_at", { ascending: false }),
      ]);
      setProfiles(p.data ?? []);
      setUnidades(u.data ?? []);
      setDocumentos(c.data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const colaboradorPodeAdiantamento = (colaboradorId: string) => {
    const profile = profiles.find(p => p.id === colaboradorId);
    if (!profile) return false;
    const unidade = unidades.find(u => u.id === profile.unidade_id);
    return !!(unidade?.tem_adiantamento && profile.tem_adiantamento_individual);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    if (!selectedColaborador) {
      toast.error("Selecione um colaborador");
      return;
    }
    if (!selectedMes) {
      toast.error("Selecione o mês de referência");
      return;
    }
    if (selectedTipo === "adiantamento" && !selectedQuinzena) {
      toast.error("Selecione a quinzena");
      return;
    }
    if (selectedTipo === "adiantamento" && !colaboradorPodeAdiantamento(selectedColaborador)) {
      toast.error("Este colaborador não tem direito a adiantamento.");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedColaborador}/${selectedMes}/${selectedTipo}${selectedQuinzena ? `_${selectedQuinzena}` : ''}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contracheques')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('contracheques')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('contracheques')
        .insert({
          colaborador_id: selectedColaborador,
          tipo: selectedTipo,
          mes_referencia: selectedMes,
          quinzena: selectedTipo === 'adiantamento' ? selectedQuinzena : null,
          url_arquivo: urlData.publicUrl,
        });
      if (insertError) throw insertError;

      toast.success("Arquivo enviado com sucesso!");
      setFile(null);
      // Resetar campos do formulário
      setSelectedColaborador("");
      setSelectedMes("");
      setSelectedQuinzena(null);
      load();
    } catch (error) {
      toast.error("Erro ao enviar", { description: (error as Error).message });
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, url: string) => {
    if (!confirm("Excluir este documento?")) return;
    try {
      const path = url.split('/').slice(3).join('/');
      await supabase.storage.from('contracheques').remove([path]);
      await supabase.from('contracheques').delete().eq('id', id);
      toast.success("Excluído");
      load();
    } catch (error) {
      toast.error("Erro ao excluir");
      console.error(error);
    }
  };

  const getProfileName = (id: string) => {
    const p = profiles.find(prof => prof.id === id);
    return p?.nome || "Colaborador";
  };

  const getUnidadeName = (id: string) => {
    const u = unidades.find(uni => uni.id === id);
    return u?.nome || "";
  };

  // Gerar lista de meses (últimos 12 meses)
  const meses = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: `${date.toLocaleString('pt-BR', { month: 'long' })}/${date.getFullYear()}`
    };
  });

  // Filtrar documentos
  const documentosFiltrados = documentos.filter(d => {
    if (filtroColaborador && d.colaborador_id !== filtroColaborador) return false;
    if (filtroMes && d.mes_referencia !== filtroMes) return false;
    if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
    return true;
  });

  // Verificar se o formulário está válido para upload
  const isFormValid = file && selectedColaborador && selectedMes && 
    (selectedTipo === "mensal" || (selectedTipo === "adiantamento" && selectedQuinzena));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="size-6 text-primary" /> Contracheques
          </h1>
          <p className="text-muted-foreground mt-1">
            Importe e gerencie contracheques mensais e adiantamentos quinzenais.
          </p>
        </div>
      </div>

      {/* Formulário de Upload */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="size-5 text-primary" /> Novo Upload
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <p>
            <b>Adiantamento:</b> só aparece para colaboradores que têm direito (unidade com adiantamento + perfil habilitado).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map(p => {
                  const pode = colaboradorPodeAdiantamento(p.id);
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {pode && "(Adiantamento)"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={selectedTipo} onValueChange={(v: "mensal" | "adiantamento") => {
              setSelectedTipo(v);
              if (v === "mensal") setSelectedQuinzena(null);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="adiantamento">Adiantamento Quinzenal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mês de Referência *</Label>
            <Select value={selectedMes} onValueChange={setSelectedMes}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {meses.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTipo === "adiantamento" && (
            <div className="space-y-2">
              <Label>Quinzena *</Label>
              <Select value={selectedQuinzena?.toString() || ""} onValueChange={(v) => setSelectedQuinzena(Number(v) as 1 | 2)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1ª Quinzena (1-15)</SelectItem>
                  <SelectItem value="2">2ª Quinzena (16-último)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label>Arquivo PDF *</Label>
            <Input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
          </div>
        </div>

        <Button onClick={handleUpload} disabled={uploading || !isFormValid}>
          {uploading ? "Enviando..." : <><Upload className="size-4 mr-2" /> Enviar</>}
        </Button>
      </div>

      {/* Filtros e Lista */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-semibold">Documentos Enviados</h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtros:</span>
            </div>
            
            <Select value={filtroColaborador} onValueChange={setFiltroColaborador}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {profiles.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                {meses.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroTipo} onValueChange={(v: "todos" | "mensal" | "adiantamento") => setFiltroTipo(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="adiantamento">Adiantamento</SelectItem>
              </SelectContent>
            </Select>

            {(filtroColaborador || filtroMes || filtroTipo !== "todos") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiltroColaborador("");
                  setFiltroMes("");
                  setFiltroTipo("todos");
                }}
              >
                <X className="size-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando...</div>
        ) : documentosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum documento encontrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {documentosFiltrados.map((doc) => {
              const profile = profiles.find(p => p.id === doc.colaborador_id);
              const unidade = unidades.find(u => u.id === profile?.unidade_id);
              return (
                <div key={doc.id} className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/10">
                  <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{profile?.nome || "Colaborador"}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn(
                          doc.tipo === 'mensal' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                          {doc.tipo === 'mensal' ? 'Mensal' : `Adiantamento ${doc.quinzena}ª`}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> {doc.mes_referencia}
                        </span>
                        {unidade && <span>• {unidade.nome}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="rounded-full">
                      <a href={doc.url_arquivo} target="_blank" rel="noopener noreferrer">
                        <Download className="size-4 mr-1" /> PDF
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(doc.id, doc.url_arquivo)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}