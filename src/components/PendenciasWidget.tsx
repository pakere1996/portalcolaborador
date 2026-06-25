import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  FileText,
  Coins,
  Scale,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { usePendencias } from "@/lib/pendencias-context";
import { toast } from "sonner";

interface PendenciasWidgetProps {
  titulo?: string;
  emptyMessage?: string;
  viewAllLink?: string;
  viewAllLabel?: string;
  maxItems?: number;
}

// 🔥 Corrigido: usar 'solicitacao' em vez de 'troca'
const ICON_MAP = {
  solicitacao: { icon: UserCheck, color: "text-blue-600", bg: "bg-blue-50" },
  contracheque: { icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
  adiantamento: { icon: Coins, color: "text-cyan-600", bg: "bg-cyan-50" },
  folha_ponto: { icon: Clock, color: "text-emerald-600", bg: "bg-emerald-50" },
  negociacao: { icon: Scale, color: "text-amber-600", bg: "bg-amber-50" },
};

const TIPO_LABEL = {
  solicitacao: "Exceção",
  contracheque: "Contracheque",
  adiantamento: "Adiantamento",
  folha_ponto: "Folha de Ponto",
  negociacao: "Negociação",
};

export function PendenciasWidget({
  titulo = "Pendências",
  emptyMessage = "Nenhuma pendência no momento.",
  viewAllLink = "/admin/folgas",
  viewAllLabel = "Ver todas",
  maxItems = 5,
}: PendenciasWidgetProps) {
  const { pendencias, loading, adiarPendencia } = usePendencias();
  const [adiarDialog, setAdiarDialog] = useState<{
    open: boolean;
    identificador: string | null;
    dias: number;
  }>({
    open: false,
    identificador: null,
    dias: 1,
  });

  const itensExibidos = pendencias.slice(0, maxItems);
  const temMais = pendencias.length > maxItems;

  const handleAdiar = async () => {
    if (!adiarDialog.identificador) {
      toast.error("Identificador da pendência não encontrado.");
      return;
    }
    if (adiarDialog.dias < 1) {
      toast.error("Informe um número de dias válido.");
      return;
    }
    await adiarPendencia(adiarDialog.identificador, adiarDialog.dias);
    setAdiarDialog({ open: false, identificador: null, dias: 1 });
  };

  const abrirAdiar = (identificador: string) => {
    setAdiarDialog({ open: true, identificador, dias: 1 });
  };

  if (loading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="size-5 text-muted-foreground" />
            {titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendencias.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="size-5 text-muted-foreground" />
            {titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2 className="size-10 text-emerald-500 mb-2" />
            <span className="text-muted-foreground">{emptyMessage}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50 shadow-sm flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <Bell className="size-5" />
            {titulo}
            <Badge className="ml-2 bg-amber-600 text-white">{pendencias.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto max-h-[400px] pr-1">
          <div className="space-y-2">
            {itensExibidos.map((p) => {
              // 🔥 Acesso seguro ao mapa, com fallback para caso a chave não exista
              const iconConfig = ICON_MAP[p.tipo as keyof typeof ICON_MAP];
              const IconComponent = iconConfig?.icon || AlertCircle;
              const colorClass = iconConfig?.color || "text-gray-600";
              const bgClass = iconConfig?.bg || "bg-gray-50";
              const tipoLabel = TIPO_LABEL[p.tipo as keyof typeof TIPO_LABEL] || p.tipo;

              const diasAtraso = p.dias_atraso ?? 0;
              const isAtrasado = diasAtraso > 0;

              return (
                <div
                  key={p.id}
                  className={`flex items-start justify-between p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
                    isAtrasado ? "border-red-200 bg-red-50/50" : "border-amber-100"
                  }`}
                >
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className={`size-8 rounded-full ${bgClass} flex items-center justify-center shrink-0 mt-0.5`}>
                      <IconComponent className={`size-4 ${colorClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{p.titulo}</span>
                        {isAtrasado && (
                          <Badge
                            variant="outline"
                            className="bg-red-100 text-red-700 border-red-200 text-[10px]"
                          >
                            <AlertCircle className="size-3 mr-0.5" />
                            Atrasado {diasAtraso} dia{diasAtraso > 1 ? 's' : ''}
                          </Badge>
                        )}
                        {!isAtrasado && diasAtraso === 0 && (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-700 border-green-200 text-[10px]"
                          >
                            <CheckCircle2 className="size-3 mr-0.5" />
                            Hoje
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{p.descricao}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {tipoLabel} • Vencimento: {new Date(p.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Link to={p.rota_resolver}>
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2 border-amber-300 hover:bg-amber-50">
                        <ArrowRight className="size-3 mr-1" /> Resolver
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2 text-muted-foreground"
                      onClick={() => abrirAdiar(p.identificador_unico)}
                    >
                      <CalendarClock className="size-3 mr-1" /> Adiar
                    </Button>
                  </div>
                </div>
              );
            })}
            {temMais && (
              <div className="text-center pt-2">
                <Link to={viewAllLink}>
                  <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
                    Ver mais {pendencias.length - maxItems} pendência(s)
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={adiarDialog.open} onOpenChange={(open) => !open && setAdiarDialog({ open: false, identificador: null, dias: 1 })}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adiar pendência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dias">Dias para reexibição</Label>
              <Input
                id="dias"
                type="number"
                min={1}
                max={365}
                value={adiarDialog.dias}
                onChange={(e) => setAdiarDialog({ ...adiarDialog, dias: parseInt(e.target.value) || 1 })}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">A pendência reaparecerá após este período.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdiarDialog({ open: false, identificador: null, dias: 1 })}>
              Cancelar
            </Button>
            <Button onClick={handleAdiar} className="bg-amber-600 hover:bg-amber-700 text-white">
              Adiar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}