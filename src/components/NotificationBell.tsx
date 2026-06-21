import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBR } from "@/lib/folga-rules";

interface Notification {
  id: string;
  tipo: "atestado_pendente" | "aviso" | "folga";
  mensagem: string;
  link?: string;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [atestadosPendentes, setAtestadosPendentes] = useState<any[]>([]);

  // 🔥 Função para carregar atestados pendentes (sem join problemático)
  const carregarAtestadosPendentes = async () => {
    if (!user) return;

    try {
      // 1. Buscar IDs dos atestados pendentes
      const { data: atestadosRaw, error } = await supabase
        .from("atestados")
        .select("id, colaborador_id, data_atestado, dias_afastamento, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });

      if (error) throw error;

      let atestados = atestadosRaw ?? [];

      // 2. Buscar nomes dos colaboradores separadamente
      if (atestados.length > 0) {
        const colaboradorIds = [...new Set(atestados.map(a => a.colaborador_id))];
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", colaboradorIds);

        const profMap = new Map((profs ?? []).map(p => [p.id, p.nome]));
        atestados = atestados.map(a => ({
          ...a,
          profiles: { nome: profMap.get(a.colaborador_id) ?? "Colaborador" },
        }));
      }

      setAtestadosPendentes(atestados);

      // 3. Criar notificações para atestados pendentes
      const notificacoesAtestados = atestados.map((a: any) => ({
        id: `atestado-${a.id}`,
        tipo: "atestado_pendente" as const,
        mensagem: `${a.profiles.nome} - Atestado de ${formatBR(new Date(a.data_atestado + "T00:00:00"))}`,
        link: "/admin/documentos/atestados",
        lida: false,
        created_at: a.created_at,
      }));

      // 4. Buscar notificações do sistema (se houver tabela)
      const { data: notificacoesSistema } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const sistema = (notificacoesSistema || []).map((n: any) => ({
        ...n,
        tipo: "aviso" as const,
      }));

      // 5. Combinar e ordenar por data
      const todas = [...notificacoesAtestados, ...sistema]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(todas);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    }
  };

  // 🔥 Carregar notificações e atestados pendentes
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      await carregarAtestadosPendentes();
      setLoading(false);
    };

    load();

    // 🔥 Intervalo com cleanup para evitar múltiplas instâncias
    const intervalId = setInterval(() => {
      if (!loading) {
        carregarAtestadosPendentes();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(intervalId);
  }, [user]);

  const contarNaoLidas = () => {
    return notifications.filter(n => !n.lida).length;
  };

  const marcarComoLida = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const handleLinkClick = (link?: string) => {
    if (link) {
      window.location.href = link;
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Marca todas como lidas ao abrir
      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
    }
  };

  const totalNaoLidas = contarNaoLidas();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-10 rounded-full">
          <Bell className="size-5" />
          {totalNaoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <span className="font-semibold">Notificações</span>
          {totalNaoLidas > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({totalNaoLidas} não lida{totalNaoLidas > 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <span className="animate-pulse">Carregando...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Bell className="size-8 mb-2 opacity-20" />
              <span className="text-sm">Nenhuma notificação</span>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={cn(
                  "p-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/50 transition-colors",
                  !notif.lida && "bg-blue-50/50"
                )}
                onClick={() => {
                  marcarComoLida(notif.id);
                  if (notif.link) {
                    handleLinkClick(notif.link);
                  }
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{notif.mensagem}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBR(new Date(notif.created_at))}
                    </p>
                  </div>
                  {!notif.lida && (
                    <div className="size-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        {notifications.length > 0 && (
          <div className="p-2 border-t border-border text-center">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                // Marca todas como lidas
                setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
              }}
            >
              Marcar todas como lidas
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}