import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface Pendencia {
  id: string;
  colaborador_nome: string;
  data_atestado: string;
  dias_afastamento: number;
  status?: string;
  created_at?: string;
}

interface PendenciasWidgetProps {
  pendentes: Pendencia[];
  totalPendentes: number;
  loading: boolean;
  titulo?: string;
  emptyMessage?: string;
  viewAllLink?: string;
  viewAllLabel?: string;
  maxItems?: number;
}

export function PendenciasWidget({
  pendentes,
  totalPendentes,
  loading,
  titulo = "Pendências",
  emptyMessage = "Nenhuma pendência no momento.",
  viewAllLink = "/admin/documentos/atestados",
  viewAllLabel = "Ver todas",
  maxItems = 5,
}: PendenciasWidgetProps) {
  // Exibe no máximo maxItems itens, mas mostra o total no badge
  const itensExibidos = pendentes.slice(0, maxItems);
  const temMais = pendentes.length > maxItems;

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

  if (totalPendentes === 0) {
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
    <Card className="border-amber-200 bg-amber-50/50 shadow-sm flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Bell className="size-5" />
          {titulo}
          <Badge className="ml-2 bg-amber-600 text-white">{totalPendentes}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-[400px] pr-1">
        {pendentes.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-2">
            {itensExibidos.map((p) => {
              const dataAtestado = new Date(p.data_atestado + "T00:00:00");
              const hoje = new Date();
              hoje.setHours(0, 0, 0, 0);
              const diffDias = Math.ceil((hoje.getTime() - dataAtestado.getTime()) / (1000 * 60 * 60 * 24));
              const isAtrasado = diffDias > 0;

              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow ${
                    isAtrasado ? "border-red-200 bg-red-50/50" : "border-amber-100"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{p.colaborador_nome}</span>
                      {isAtrasado && (
                        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                          <AlertCircle className="size-3 mr-0.5" />
                          Atrasado {diffDias} dia(s)
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>Atestado de {dataAtestado.toLocaleDateString("pt-BR")}</span>
                      <span>•</span>
                      <span>{p.dias_afastamento} dia(s)</span>
                      <span className="text-xs text-amber-600 flex items-center gap-0.5">
                        <Clock className="size-3" />
                        Pendente
                      </span>
                    </div>
                  </div>
                  <Link to={viewAllLink}>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                      Revisar
                    </Button>
                  </Link>
                </div>
              );
            })}
            {temMais && (
              <div className="text-center pt-2">
                <Link to={viewAllLink}>
                  <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
                    Ver mais {pendentes.length - maxItems} pendência(s)
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}