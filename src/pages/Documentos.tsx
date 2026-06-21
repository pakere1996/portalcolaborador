"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Calendar, Download, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";

type Contracheque = Tables<'contracheques'>;

export default function DocumentosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documentos, setDocumentos] = useState<Contracheque[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "mensal" | "adiantamento">("todos");
  const [filtroMes, setFiltroMes] = useState<string>("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contracheques")
        .select("*")
        .eq("colaborador_id", user.id)
        .order("mes_referencia", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocumentos(data ?? []);
    } catch (error) {
      toast.error("Erro ao carregar documentos");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Gerar lista de meses únicos dos documentos
  const mesesDisponiveis = Array.from(
    new Set(documentos.map(d => d.mes_referencia))
  ).sort().reverse();

  const filtered = documentos.filter(d => {
    if (filtroTipo !== "todos" && d.tipo !== filtroTipo) return false;
    if (filtroMes && d.mes_referencia !== filtroMes) return false;
    return true;
  });

  const getLabel = (doc: Contracheque) => {
    if (doc.tipo === "mensal") return "Mensal";
    return `Adiantamento ${doc.quinzena}ª Quinzena`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FileText className="size-6 text-primary" /> Meus Documentos
        </h1>
        <p className="text-muted-foreground mt-1">Visualize seus contracheques e adiantamentos.</p>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtrar:</span>
        </div>

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

        <Select value={filtroMes} onValueChange={setFiltroMes}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos</SelectItem>
            {mesesDisponiveis.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filtroTipo !== "todos" || filtroMes) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFiltroTipo("todos");
              setFiltroMes("");
            }}
          >
            <X className="size-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
          Nenhum documento encontrado.
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((doc) => (
            <div key={doc.id} className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="size-6 text-primary" />
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {getLabel(doc)}
                    <Badge variant="outline" className={cn(
                      doc.tipo === 'mensal' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    )}>
                      {doc.tipo}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calendar className="size-3.5" />
                    {doc.mes_referencia}
                    {doc.tipo === "adiantamento" && ` - ${doc.quinzena}ª Quinzena`}
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" className="rounded-full">
                <a href={doc.url_arquivo} target="_blank" rel="noopener noreferrer">
                  <Download className="size-4 mr-2" /> Baixar PDF
                </a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}