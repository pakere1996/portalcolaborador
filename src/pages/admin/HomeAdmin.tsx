import { useEffect } from "react";
import { useAtestadosPendentes } from "@/lib/atestados-pendentes-context";
import { useFavoritos } from "@/lib/useFavoritos";
import { AniversariantesWidget } from "@/components/AniversariantesWidget";
import { FavoritosGrid } from "@/components/FavoritosGrid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { X } from "lucide-react";

export default function AdminHomeAdminPage() {
  const { pendentes, totalPendentes, loading: loadingAtestados, showNotification, setShowNotification } = useAtestadosPendentes();
  const { favoritos, loading: loadingFavoritos } = useFavoritos();

  // Toast de notificação
  useEffect(() => {
    if (totalPendentes > 0 && !showNotification) {
      toast.info(`📋 ${totalPendentes} atestado(s) pendente(s) de aprovação`, {
        duration: 6000,
        action: {
          label: "Ver agora",
          onClick: () => {
            window.location.href = "/admin/documentos/atestados";
          },
        },
      });
    }
  }, [totalPendentes, showNotification]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Bell className="size-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral e atalhos rápidos.</p>
      </div>

      {/* 🔥 Grid: Pendências (esquerda) + Aniversariantes (direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendências */}
        {loadingAtestados ? (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="size-5 text-muted-foreground" />
                Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ) : totalPendentes > 0 ? (
          <Card className="border-amber-200 bg-amber-50/50 shadow-sm flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Bell className="size-5" />
                Pendências
                <Badge className="ml-2 bg-amber-600 text-white">{totalPendentes}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto max-h-[400px]">
              <div className="space-y-2 pr-1">
                {pendentes.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="font-medium">{p.colaborador_nome}</div>
                      <div className="text-sm text-muted-foreground">
                        Atestado de {new Date(p.data_atestado + "T00:00:00").toLocaleDateString("pt-BR")}
                        {" • "}
                        {p.dias_afastamento} dia(s)
                      </div>
                    </div>
                    <Link to="/admin/documentos/atestados">
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                        Revisar
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="size-5 text-muted-foreground" />
                Pendências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-6">
                Nenhuma pendência no momento.
              </div>
            </CardContent>
          </Card>
        )}

        {/* Aniversariantes */}
        <AniversariantesWidget />
      </div>

      {/* 🔥 Favoritos – ocupando largura total, com cards ajustados */}
      <FavoritosGrid />

      {/* AlertDialog – notificação em tela */}
      <AlertDialog open={showNotification} onOpenChange={setShowNotification}>
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <AlertDialogTitle className="flex items-center gap-2 text-amber-800">
                <Bell className="size-5 text-amber-600" />
                Atenção: Atestados Pendentes
              </AlertDialogTitle>
              <Button variant="ghost" size="icon" onClick={() => setShowNotification(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </AlertDialogHeader>

          <AlertDialogDescription asChild>
            <div className="text-base text-muted-foreground">
              Existem <strong>{totalPendentes}</strong> atestado(s) aguardando sua aprovação.
              <br />
              <br />
              {pendentes.map((p) => (
                <div key={p.id} className="flex items-center gap-2 mt-1 text-sm">
                  <span className="font-medium">{p.colaborador_nome}</span>
                  <span className="text-muted-foreground">
                    • {new Date(p.data_atestado + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </AlertDialogDescription>

          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNotification(false)}>
              Fechar
            </Button>
            <Link to="/admin/documentos/atestados">
              <Button onClick={() => setShowNotification(false)}>
                Ir para Atestados
              </Button>
            </Link>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}