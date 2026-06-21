import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatBR } from "@/lib/folga-rules";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notification[]>([]);
  const [atestadosPendentes, setAtestadosPendentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const isAdmin = role === "admin" || localStorage.getItem('user_role') === 'admin';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Carrega notificações do sistema
      const { data: notifData } = await supabase
        .from("notificacoes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setNotificacoes(notifData ?? []);

      // 🔥 Se for admin, busca atestados pendentes
      if (isAdmin) {
        const { data: atestados } = await supabase
          .from("atestados")
          .select("id, colaborador_id, data_atestado, dias_afastamento, created_at, profiles(nome)")
          .eq("status", "pendente")
          .order("created_at", { ascending: false });

        if (atestados && atestados.length > 0) {
          setAtestadosPendentes(atestados);
        } else {
          setAtestadosPendentes([]);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Recarregar a cada 30 segundos
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user, isAdmin]);

  const marcarComoLida = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const totalNaoLidas = notificacoes.filter(n => !n.lida).length + (atestadosPendentes.length > 0 ? 1 : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {totalNaoLidas > 0 && (
            <span className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[400px] overflow-y-auto p-0" align="end">
        <div className="p-3 border-b border-border">
          <span className="font-semibold">Notificações</span>
        </div>
        <div className="p-2 space-y-2">
          {loading ? (
            <div className="text-center p-4 text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <>
              {/* 🔥 Atestados pendentes para admin */}
              {isAdmin && atestadosPendentes.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-amber-600 font-semibold text-sm">📋 Atestados Pendentes</span>
                    <Badge className="bg-amber-500 text-white">{atestadosPendentes.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {atestadosPendentes.slice(0, 3).map((a) => (
                      <div key={a.id} className="text-xs text-amber-800">
                        <span className="font-medium">{a.profiles?.nome || "Colaborador"}</span>
                        {" - "}
                        {formatBR(new Date(a.data_atestado + "T00:00:00"))}
                        {" ("}{a.dias_afastamento} dia{a.dias_afastamento > 1 ? "s" : ""}{")"}
                      </div>
                    ))}
                    {atestadosPendentes.length > 3 && (
                      <div className="text-xs text-amber-600 font-medium">
                        + {atestadosPendentes.length - 3} outros atestados
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 text-amber-700 border-amber-300 hover:bg-amber-100 h-7 text-xs"
                      onClick={() => {
                        setOpen(false);
                        navigate("/admin/documentos/atestados");
                      }}
                    >
                      Ver todos os atestados
                    </Button>
                  </div>
                </div>
              )}

              {/* Notificações do sistema */}
              {notificacoes.length === 0 && atestadosPendentes.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground text-sm">
                  Nenhuma notificação
                </div>
              ) : (
                notificacoes.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${!n.lida ? "bg-primary/5" : ""}`}
                    onClick={() => {
                      if (!n.lida) marcarComoLida(n.id);
                      if (n.link) {
                        setOpen(false);
                        navigate(n.link);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`size-2 rounded-full mt-1.5 shrink-0 ${!n.lida ? "bg-blue-500" : "bg-transparent"}`} />
                      <div>
                        <div className="text-sm font-medium">{n.titulo}</div>
                        <div className="text-xs text-muted-foreground">{n.mensagem}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}