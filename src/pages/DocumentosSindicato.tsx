import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Building2, FileText, Download, Eye, Users, Calendar, Scale, File } from "lucide-react";
import { formatBR, parseYMD } from "@/lib/folga-rules";

interface Sindicato {
  id: string;
  nome: string;
  cnpj: string | null;
  contato_whatsapp: string | null;
  tipo: "laboral" | "patronal";
}

interface Negociacao {
  id: string;
  ano: number;
  mes: number;
  tipo_documento: "act" | "cct";
  storage_path: string | null;
  nome_pdf: string | null;
  sindicato_patronal_id: string;
  sindicato_laboral_id: string;
  unidade_id: string;
  created_at: string;
  sindicato_patronal?: Sindicato;
  sindicato_laboral?: Sindicato;
}

export default function DocumentosSindicato() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sindicatoLaboral, setSindicatoLaboral] = useState<Sindicato | null>(null);
  const [sindicatosPatronais, setSindicatosPatronais] = useState<Sindicato[]>([]);
  const [negociacao, setNegociacao] = useState<Negociacao | null>(null);
  const [unidadeNome, setUnidadeNome] = useState<string>("");
  const [cargoNome, setCargoNome] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    carregarDados();
  }, [user]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Buscar perfil do colaborador
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("unidade_id, cargo_id, nome")
        .eq("id", user?.id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.unidade_id || !profile?.cargo_id) {
        toast.warning("Seu perfil não está vinculado a uma unidade ou cargo.");
        setLoading(false);
        return;
      }

      // 2. Buscar unidade e cargo
      const [unidadeRes, cargoRes] = await Promise.all([
        supabase.from("unidades").select("nome").eq("id", profile.unidade_id).single(),
        supabase.from("cargos").select("nome").eq("id", profile.cargo_id).single(),
      ]);

      if (unidadeRes.data) setUnidadeNome(unidadeRes.data.nome);
      if (cargoRes.data) setCargoNome(cargoRes.data.nome);

      // 3. Buscar vínculo do cargo com sindicato laboral na unidade
      const { data: unidadeCargo, error: ucError } = await supabase
        .from("unidade_cargos")
        .select("sindicato_laboral_id")
        .eq("unidade_id", profile.unidade_id)
        .eq("cargo_id", profile.cargo_id)
        .maybeSingle();

      if (ucError) throw ucError;
      if (!unidadeCargo?.sindicato_laboral_id) {
        toast.warning("Seu cargo não possui sindicato laboral vinculado.");
        setLoading(false);
        return;
      }

      // 4. Buscar dados do sindicato laboral
      const { data: sindLaboral, error: slError } = await supabase
        .from("sindicatos")
        .select("*")
        .eq("id", unidadeCargo.sindicato_laboral_id)
        .single();

      if (slError) throw slError;
      setSindicatoLaboral(sindLaboral);

      // 5. Buscar sindicatos patronais da unidade
      const { data: vincPatronais, error: vpError } = await supabase
        .from("sindicato_unidades")
        .select("sindicato_id")
        .eq("unidade_id", profile.unidade_id);

      if (vpError) throw vpError;
      const idsPatronais = vincPatronais.map(v => v.sindicato_id);
      if (idsPatronais.length === 0) {
        toast.warning("Sua unidade não possui sindicato patronal vinculado.");
        setLoading(false);
        return;
      }

      const { data: sindPatronais, error: spError } = await supabase
        .from("sindicatos")
        .select("*")
        .in("id", idsPatronais);
      if (spError) throw spError;
      setSindicatosPatronais(sindPatronais || []);

      // 6. Buscar negociação mais recente (ACT/CCT)
      const { data: negociacaoData, error: negError } = await supabase
        .from("negociacoes")
        .select(`
          *,
          sindicato_patronal:sindicatos!negociacoes_sindicato_patronal_id_fkey(id, nome, cnpj, contato_whatsapp),
          sindicato_laboral:sindicatos!negociacoes_sindicato_laboral_id_fkey(id, nome, cnpj, contato_whatsapp)
        `)
        .eq("unidade_id", profile.unidade_id)
        .eq("sindicato_laboral_id", unidadeCargo.sindicato_laboral_id)
        .in("sindicato_patronal_id", idsPatronais)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (negError) throw negError;
      if (negociacaoData) {
        setNegociacao(negociacaoData);
      } else {
        toast.info("Nenhuma negociação encontrada para seu sindicato e unidade.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados sindicais");
    } finally {
      setLoading(false);
    }
  };

  const downloadArquivo = async (path: string, nome: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("sindicatos")
        .download(path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao baixar arquivo");
    }
  };

  const visualizarArquivo = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("sindicatos")
        .createSignedUrl(path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao visualizar arquivo");
    }
  };

  const formatarMes = (mes: number) => {
    return new Date(2000, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' });
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="size-6 text-primary" /> Sindicato
        </h1>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!sindicatoLaboral) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="size-6 text-primary" /> Sindicato
        </h1>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum sindicato laboral vinculado ao seu cargo nesta unidade.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Scale className="size-7 text-primary" />
        <h1 className="text-2xl md:text-3xl font-bold">Informações Sindicais</h1>
      </div>

      {/* Informações do colaborador */}
      <div className="bg-muted/30 rounded-2xl p-4 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">Unidade</span>
          <p className="font-semibold">{unidadeNome || "—"}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Cargo</span>
          <p className="font-semibold">{cargoNome || "—"}</p>
        </div>
      </div>

      {/* Sindicato Laboral */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <Users className="size-5 text-primary" /> Sindicato Laboral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Nome</span>
              <p className="font-semibold">{sindicatoLaboral.nome}</p>
            </div>
            {sindicatoLaboral.cnpj && (
              <div>
                <span className="text-sm text-muted-foreground">CNPJ</span>
                <p className="font-mono">{sindicatoLaboral.cnpj}</p>
              </div>
            )}
            {sindicatoLaboral.contato_whatsapp && (
              <div>
                <span className="text-sm text-muted-foreground">WhatsApp</span>
                <p>{sindicatoLaboral.contato_whatsapp}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sindicatos Patronais da Unidade */}
      {sindicatosPatronais.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Sindicatos Patronais da Unidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sindicatosPatronais.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-sm py-1.5 px-3">
                  {s.nome}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Negociação / Documento ACT/CCT */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Documento Coletivo (ACT/CCT)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {negociacao ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Data Base</span>
                  <p className="font-semibold">
                    {formatarMes(negociacao.mes)}/{negociacao.ano}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Tipo</span>
                  <Badge variant={negociacao.tipo_documento === "act" ? "default" : "secondary"}>
                    {negociacao.tipo_documento.toUpperCase()}
                  </Badge>
                </div>
                <div className="md:col-span-2">
                  <span className="text-sm text-muted-foreground">Sindicato Patronal</span>
                  <p className="font-semibold">
                    {(negociacao.sindicato_patronal as any)?.nome || "—"}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <span className="text-sm text-muted-foreground">Sindicato Laboral</span>
                  <p className="font-semibold">
                    {(negociacao.sindicato_laboral as any)?.nome || "—"}
                  </p>
                </div>
              </div>

              {negociacao.storage_path && negociacao.nome_pdf && (
                <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                  <File className="size-4 text-muted-foreground" />
                  <span className="text-sm flex-1 font-medium">{negociacao.nome_pdf}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => visualizarArquivo(negociacao.storage_path!)}
                    className="rounded-full"
                  >
                    <Eye className="size-4 mr-1" /> Visualizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadArquivo(negociacao.storage_path!, negociacao.nome_pdf!)}
                    className="rounded-full"
                  >
                    <Download className="size-4 mr-1" /> Baixar
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-6">
              Nenhum documento coletivo encontrado para o sindicato da sua função nesta unidade.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}