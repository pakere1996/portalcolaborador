import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { FileWarning, AlertCircle } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface AtestadoPendente {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  data_atestado: string;
  dias_afastamento: number;
  created_at: string;
}

export function AtestadosPendentesPopout() {
  const { user, role } = useAuth();
  const [atestados, setAtestados] = useState<AtestadoPendente[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alreadyNotified, setAlreadyNotified] = useState(false);

  const isAdmin = role === "admin" || localStorage.getItem('user_role') === "admin";

  useEffect(() => {
    // Se não for admin, não carrega
    if (!isAdmin || !user) return;

    const carregarAtestadosPendentes = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("atestados")
          .select(`
            id,
            colaborador_id,
            data_atestado,
            dias_afastamento,
            created_at,
            profiles!colaborador_id (nome)
          `)
          .eq("status", "pendente")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const pendentes = (data || []).map((item: any) => ({
          id: item.id,
          colaborador_id: item.colaborador_id,
          colaborador_nome: item.profiles?.nome || "Colaborador",
          data_atestado: item.data_atestado,
          dias_afastamento: item.dias_afastamento,
          created_at: item.created_at,
        }));

        setAtestados(pendentes);

        // Se houver pendentes e o popout ainda não foi mostrado, exibe
        if (pendentes.length > 0 && !alreadyNotified) {
          setOpen(true);
          setAlreadyNotified(true);
        }
      } catch (error) {
        console.error("Erro ao carregar atestados pendentes:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarAtestadosPendentes();

    // Inscreve para novas mudanças
    const channel = supabase
      .channel("atestados-pendentes-popout")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "atestados",
          filter: "status=eq.pendente",
        },
        () => {
          carregarAtestadosPendentes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, alreadyNotified]);

  // Se não for admin, não renderiza nada
  if (!isAdmin) return null;

  // Se não houver atestados pendentes, não abre o popout
  if (atestados.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <FileWarning className="size-5" />
            <DialogTitle className="text-xl font-bold">📋 Atestados Pendentes</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Existem {atestados.length} atestado(s) aguardando sua aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {atestados.slice(0, 5).map((atestado) => (
            <div
              key={atestado.id}
              className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-slate-900">
                  {atestado.colaborador_nome}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatBR(new Date(atestado.data_atestado + "T00:00:00"))} • {atestado.dias_afastamento} dia(s)
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                Pendente
              </Badge>
            </div>
          ))}
          {atestados.length > 5 && (
            <div className="text-center text-xs text-muted-foreground">
              + {atestados.length - 5} outros atestados pendentes
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="sm:flex-1">
            Ver depois
          </Button>
          <Link to="/admin/documentos/atestados" className="sm:flex-1">
            <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700">
              Ir para Atestados
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
