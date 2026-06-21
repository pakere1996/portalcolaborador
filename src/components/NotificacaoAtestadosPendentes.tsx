import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { toast } from "sonner";

export function NotificacaoAtestadosPendentes() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [notificado, setNotificado] = useState(false);
  const isAdmin = role === "admin" || localStorage.getItem('user_role') === "admin";

  useEffect(() => {
    if (!user || !isAdmin || notificado) return;

    const verificarPendentes = async () => {
      const { data, error } = await supabase
        .from("atestados")
        .select("id, colaborador_id, data_atestado, status, profiles(nome)")
        .eq("status", "pendente");

      if (error) return;

      if (data && data.length > 0) {
        const nomes = data.map(a => (a as any).profiles?.nome || "Colaborador").join(", ");
        toast.custom((t) => (
          <div className="bg-white border border-amber-200 rounded-xl shadow-lg p-4 max-w-md flex items-start gap-3">
            <div className="bg-amber-100 rounded-full p-2">
              <Bell className="size-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Atestados pendentes</p>
              <p className="text-sm text-muted-foreground">
                {data.length} atestado(s) aguardando aprovação de {nomes}
              </p>
              <button
                onClick={() => {
                  navigate("/admin/documentos/atestados");
                  toast.dismiss(t);
                }}
                className="text-xs text-primary font-medium hover:underline mt-1"
              >
                Ver atestados pendentes →
              </button>
            </div>
            <button
              onClick={() => toast.dismiss(t)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        ), {
          duration: 10000,
          position: "top-right",
        });

        setNotificado(true);
      }
    };

    const timeout = setTimeout(verificarPendentes, 3000);
    return () => clearTimeout(timeout);
  }, [user, isAdmin, notificado, navigate]);

  return null;
}
