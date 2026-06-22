import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAtestadosPendentes } from "@/lib/atestados-pendentes-context";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { totalPendentes, carregarPendentes } = useAtestadosPendentes();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarNotificacoes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: notifs, error: notifsError } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (notifsError) throw notifsError;
      setNotificacoes(notifs ?? []);
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotificacoes();
    const interval = setInterval(() => {
      carregarPendentes();
    }, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const marcarComoLida = async (id: string) => {
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao marcar notificação como lida");
      return;
    }
    setNotificacoes(notificacoes.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const handleClick = (notif: Notificacao) => {
    if (!notif.lida) marcarComoLida(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const totalNaoLidas = notificacoes.filter(n => !n.lida).length;
  const total = totalNaoLidas + totalPendentes;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {total > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Carregando...</div>
        ) : notificacoes.length === 0 && totalPendentes === 0 ? (
          <div className="p-4 text-center text-muted-foreground">Nenhuma notificação</div>
        ) : (
          <>
            {totalPendentes > 0 && (
              <DropdownMenuItem
                className="flex items-start gap-2 p-3 cursor-pointer bg-amber-50 hover:bg-amber-100 border-b border-amber-200"
                onClick={() => navigate("/admin/documentos/atestados")}
              >
                <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-amber-800">Atestados Pendentes</div>
                  <div className="text-sm text-amber-700">{totalPendentes} atestado(s) aguardando aprovação</div>
                </div>
              </DropdownMenuItem>
            )}
            {notificacoes.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={`flex items-start gap-2 p-3 cursor-pointer ${!notif.lida ? "bg-muted/30" : ""}`}
                onClick={() => handleClick(notif)}
              >
                {notif.lida ? (
                  <CheckCircle className="size-5 text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="size-5 text-blue-500 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className={`${!notif.lida ? "font-semibold" : ""}`}>{notif.titulo}</div>
                  <div className="text-sm text-muted-foreground">{notif.mensagem}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(notif.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            {notificacoes.length > 0 && (
              <DropdownMenuItem
                className="justify-center text-sm text-muted-foreground"
                onClick={() => {
                  const naoLidas = notificacoes.filter(n => !n.lida).map(n => n.id);
                  if (naoLidas.length === 0) return;
                  supabase.from("notificacoes").update({ lida: true }).in("id", naoLidas).then(() => {
                    setNotificacoes(notificacoes.map(n => ({ ...n, lida: true })));
                    toast.success("Todas as notificações marcadas como lidas");
                  });
                }}
              >
                Marcar todas como lidas
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}