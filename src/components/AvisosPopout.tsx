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
import { Bell, X } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";

interface Aviso {
  id: string;
  titulo: string;
  mensagem: string;
  data_inicio: string;
  data_fim: string;
  para_todos: boolean;
  colaborador_id: string | null;
  ativo: boolean;
  created_at: string;
}

export function AvisosPopout() {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avisoAtual, setAvisoAtual] = useState<Aviso | null>(null);
  const [avisosLidos, setAvisosLidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const carregarAvisos = async () => {
      setLoading(true);
      try {
        const hoje = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from("avisos")
          .select("*")
          .eq("ativo", true)
          .lte("data_inicio", hoje)
          .gte("data_fim", hoje)
          .or(`para_todos.eq.true,colaborador_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Filtra avisos já lidos (armazenados no localStorage)
        const lidos = JSON.parse(localStorage.getItem('avisos_lidos') || '[]');
        setAvisosLidos(new Set(lidos));

        const avisosNaoLidos = (data || []).filter(a => !lidos.includes(a.id));
        setAvisos(avisosNaoLidos);

        // Se houver avisos não lidos, exibe o primeiro
        if (avisosNaoLidos.length > 0) {
          setAvisoAtual(avisosNaoLidos[0]);
          setOpen(true);
        }
      } catch (error) {
        console.error("Erro ao carregar avisos:", error);
      } finally {
        setLoading(false);
      }
    };

    carregarAvisos();
  }, [user]);

  const marcarComoLido = (avisoId: string) => {
    const lidos = JSON.parse(localStorage.getItem('avisos_lidos') || '[]');
    if (!lidos.includes(avisoId)) {
      lidos.push(avisoId);
      localStorage.setItem('avisos_lidos', JSON.stringify(lidos));
      setAvisosLidos(new Set(lidos));
    }
  };

  const handleClose = () => {
    if (avisoAtual) {
      marcarComoLido(avisoAtual.id);
    }
    setOpen(false);
    // Verifica se há próximo aviso
    const index = avisos.findIndex(a => a.id === avisoAtual?.id);
    const proximo = avisos[index + 1];
    if (proximo) {
      setAvisoAtual(proximo);
      setOpen(true);
    } else {
      setAvisoAtual(null);
    }
  };

  const handlePular = () => {
    if (avisoAtual) {
      marcarComoLido(avisoAtual.id);
      const index = avisos.findIndex(a => a.id === avisoAtual.id);
      const proximo = avisos[index + 1];
      if (proximo) {
        setAvisoAtual(proximo);
      } else {
        setOpen(false);
        setAvisoAtual(null);
      }
    }
  };

  // Se não houver avisos, não renderiza nada
  if (!avisoAtual) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Bell className="size-5" />
            <DialogTitle className="text-xl font-bold">📢 {avisoAtual.titulo}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {avisoAtual.data_inicio && avisoAtual.data_fim && (
              <span>
                Período: {formatBR(new Date(avisoAtual.data_inicio + "T00:00:00"))} até {formatBR(new Date(avisoAtual.data_fim + "T00:00:00"))}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {avisoAtual.mensagem}
          </div>
          {avisos.length > 1 && (
            <div className="mt-3 text-xs text-muted-foreground text-center">
              Aviso {avisos.findIndex(a => a.id === avisoAtual.id) + 1} de {avisos.length}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {avisos.length > 1 && (
            <Button variant="ghost" size="sm" onClick={handlePular} className="sm:flex-1">
              Próximo →
            </Button>
          )}
          <Button onClick={handleClose} size="sm" className="sm:flex-1">
            {avisos.length === 1 ? "Fechar" : "Fechar e continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}