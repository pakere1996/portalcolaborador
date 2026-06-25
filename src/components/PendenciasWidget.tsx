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
  Eye,
  X,
} from "lucide-react";
import { usePendencias } from "@/lib/pendencias-context";
import { toast } from "sonner";
import { useEffect } from "react";

interface PendenciasWidgetProps {
  titulo?: string;
  emptyMessage?: string;
  viewAllLink?: string;
  viewAllLabel?: string;
  maxItems?: number;
}

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

// Hook para detectar mobile
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
};

export function PendenciasWidget({
  titulo = "Pendências",
  emptyMessage = "Nenhuma pendência no momento.",
  viewAllLink = "/admin/folgas",
  viewAllLabel = "Ver todas",
  maxItems = 5,
}: PendenciasWidgetProps) {
  const { pendencias, loading, adiarPendencia } = usePendencias();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [adiarDialog, setAdiarDialog] = useState<{
    open: boolean;
    identificador: string | null;
    dias: number;
  }>({
    open: false,
    identificador: null,
    dias: 1,
  });

  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    pendencia: any | null;
  }>({
    open: false,
    pendencia: null,
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
    setDetailDialog({ open: false, pendencia: null });
  };

  const abrirAdiar = (identificador: string) => {
    setAdiarDialog({ open: true, identificador, dias: 1 });
  };

  const abrirDetalhes = (pendencia: any) => {
    setDetailDialog({ open: true, pendencia });
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
                  className={`p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
                    isAtrasado ? "border-red-200 bg-red-50/50" : "border-amber-100"
                  } ${isMobile ? "cursor-pointer active:scale-[0.98]" : ""}`}
                  onClick={() => isMobile && abrirDetalhes(p)}
                >
                  <div className="flex flex-col gap-2">
                    {/* Linha superior: ícone + título + badge */}
                    <div className="flex items-start gap-3">
                      <div className={`size-8 rounded-full ${bgClass} flex items-center justify-center shrink-0 mt-0.5`}>
                        <IconComponent className={`size-4 ${colorClass}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{p.titulo}</span>
                          {isAtrasado ? (
                            <Badge
                              variant="outline"
                              className="bg-red-100 text-red-700 border-red-200 text-[10px]"
                            >
                              <AlertCircle className="size-3 mr-0.5" />
                              {diasAtraso}d
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-green-100 text-green-700 border-green-200 text-[10px]"
                            >
                              <CheckCircle2 className="size-3 mr-0.5" />
                              Hoje
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">{p.descricao}</div>
                        {!isMobile && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {tipoLabel} • Vencimento: {new Date(p.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                          </div>
                        )}
                      </div>
                      {isMobile && (
                        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={(e) => { e.stopPropagation(); abrirDetalhes(p); }}>
                          <Eye className="size-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>

                    {/* Botões: mobile empilhados, desktop lado a lado */}
                    <div className={`flex ${isMobile ? "flex-col gap-1.5" : "flex-row gap-1"} justify-end`}>
                      <Link to={p.rota_resolver} className={isMobile ? "w-full" : ""} onClick={(e) => e.stopPropagation()}>
                        <Button
                          size={isMobile ? "default" : "sm"}
                          variant="outline"
                          className={`text-xs ${isMobile ? "w-full h-8" : "h-7 px-2"} border-amber-300 hover:bg-amber-50`}
                        >
                          <ArrowRight className="size-3 mr-1" /> Resolver
                        </Button>
                      </Link>
                      <Button
                        size={isMobile ? "default" : "sm"}
                        variant="ghost"
                        className={`text-xs ${isMobile ? "w-full h-8" : "h-7 px-2"} text-muted-foreground`}
                        onClick={(e) => { e.stopPropagation(); abrirAdiar(p.identificador_unico); }}
                      >
                        <CalendarClock className="size-3 mr-1" /> Adiar
                      </Button>
                    </div>
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

      {/* Dialog de detalhes (mobile) */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => !open && setDetailDialog({ open: false, pendencia: null })}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-5 text-amber-600" />
              Detalhes da Pendência
            </DialogTitle>
          </DialogHeader>
          {detailDialog.pendencia && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="font-semibold text-lg">{detailDialog.pendencia.titulo}</div>
                <div className="text-sm text-muted-foreground">{detailDialog.pendencia.descricao}</div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                  <div>
                    <span className="text-muted-foreground">Tipo</span>
                    <div className="font-medium">{TIPO_LABEL[detailDialog.pendencia.tipo as keyof typeof TIPO_LABEL] || detailDialog.pendencia.tipo}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div className="font-medium">
                      {detailDialog.pendencia.dias_atraso > 0 ? (
                        <span className="text-red-600">Atrasado {detailDialog.pendencia.dias_atraso} dia(s)</span>
                      ) : (
                        <span className="text-green-600">Em dia</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Vencimento</span>
                    <div className="font-medium">{new Date(detailDialog.pendencia.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</div>
                  </div>
                  {detailDialog.pendencia.unidade_id && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Unidade</span>
                      <div className="font-medium">{detailDialog.pendencia.unidade_id}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t">
                <Link to={detailDialog.pendencia.rota_resolver} className="w-full" onClick={() => setDetailDialog({ open: false, pendencia: null })}>
                  <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                    <ArrowRight className="size-4 mr-2" /> Resolver Pendência
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    abrirAdiar(detailDialog.pendencia.identificador_unico);
                    setDetailDialog({ open: false, pendencia: null });
                  }}
                >
                  <CalendarClock className="size-4 mr-2" /> Adiar Pendência
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setDetailDialog({ open: false, pendencia: null })}
                >
                  <X className="size-4 mr-2" /> Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para adiar */}
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