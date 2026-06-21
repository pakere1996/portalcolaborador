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
import { Badge } from "@/components/ui/badge";

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
  const [avisosExibidos, setAvisosExibidos] = useState<Set<string>>(new Set());
  const [avisoAtual, setAvisoAtual] = useState<Aviso | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const carregarAvisos = async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from("avisos")
        .select("*")
        .eq("ativo", true)
        .lte("data_inicio", hoje)
        .gte("data_fim", hoje)
        .or(`para_todos.eq.true,colaborador_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar avisos:", error);
        return;
      }

      if (data && data.length > 0) {
        // Filtra avisos que já foram exibidos nesta sessão
        const avisosNaoExibidos = data.filter(a => !avisosExibidos.has(a.id));
        if (avisosNaoExibidos.length > 0) {
          // Marca todos como exibidos para não mostrar novamente
          const novosIds = new Set(avisosExibidos);
          avisosNaoExibidos.forEach(a => novosIds.add(a.id));
          setAvisosExibidos(novosIds);
          
          setAvisos(avisosNaoExibidos);
          // Mostra o primeiro aviso
          setAvisoAtual(avisosNaoExibidos[0]);
          setDialogOpen(true);
        }
      }
    };

    carregarAvisos();
  }, [user, avisosExibidos]);

  const handleProximo = () => {
    const index = avisos.findIndex(a => a.id === avisoAtual?.id);
    if (index < avisos.length - 1) {
      setAvisoAtual(avisos[index + 1]);
    } else {
      setDialogOpen(false);
      setAvisoAtual(null);
    }
  };

  const handleFechar = () => {
    setDialogOpen(false);
    setAvisoAtual(null);
  };

  if (!avisoAtual) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      if (!open) {
        handleFechar();
      }
      setDialogOpen(open);
    }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-primary" />
            <DialogTitle className="text-lg">{avisoAtual.titulo}</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {avisos.length > 1 && `Aviso ${avisos.indexOf(avisoAtual) + 1} de ${avisos.length}`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="prose prose-sm max-w-none">
            <p className="text-sm whitespace-pre-wrap">{avisoAtual.mensagem}</p>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="text-[10px]">
              {formatBR(new Date(avisoAtual.data_inicio + "T00:00:00"))} - {formatBR(new Date(avisoAtual.data_fim + "T00:00:00"))}
            </Badge>
            {!avisoAtual.para_todos && (
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                Pessoal
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {avisos.length > 1 && avisos.indexOf(avisoAtual) < avisos.length - 1 && (
            <Button variant="outline" onClick={handleProximo} className="flex-1">
              Próximo aviso
            </Button>
          )}
          <Button onClick={handleFechar} className="flex-1">
            {avisos.length > 1 && avisos.indexOf(avisoAtual) === avisos.length - 1 ? "Fechar" : "Fechar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
