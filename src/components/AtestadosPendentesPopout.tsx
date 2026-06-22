import { useEffect, useState } from "react";
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
import { FileWarning } from "lucide-react";
import { formatBR } from "@/lib/folga-rules";
import { useAtestadosPendentes } from "@/lib/atestados-pendentes-context";

export function AtestadosPendentesPopout() {
  const { pendentes, totalPendentes, loading, showNotification, setShowNotification } = useAtestadosPendentes();
  const [open, setOpen] = useState(false);
  const [alreadyNotified, setAlreadyNotified] = useState(false);

  // Abre o popout automaticamente quando houver pendentes e ainda não tiver notificado
  useEffect(() => {
    if (totalPendentes > 0 && !alreadyNotified && !loading) {
      setOpen(true);
      setAlreadyNotified(true);
    }
  }, [totalPendentes, alreadyNotified, loading]);

  // Se não houver pendentes, não renderiza o popout
  if (totalPendentes === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600">
            <FileWarning className="size-5" />
            <DialogTitle className="text-xl font-bold">📋 Atestados Pendentes</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Existem {totalPendentes} atestado(s) aguardando sua aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {pendentes.slice(0, 5).map((atestado) => (
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
          {pendentes.length > 5 && (
            <div className="text-center text-xs text-muted-foreground">
              + {pendentes.length - 5} outros atestados pendentes
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