import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { atestadoId, colaboradorNome } = await req.json();

    const { data: atestado, error: atestadoError } = await supabaseAdmin
      .from("atestados")
      .select("id, user_id, status")
      .eq("id", atestadoId)
      .maybeSingle();

    if (atestadoError || !atestado) {
      return new Response(JSON.stringify({ error: "Atestado não encontrado." }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (atestado.user_id !== user.id && !roleData) {
      return new Response(JSON.stringify({ error: "Sem permissão para notificar este atestado." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const notifications = (admins ?? []).map(({ user_id }) => ({
      user_id,
      tipo: "atestado_pendente",
      titulo: "Novo atestado pendente",
      mensagem: `${colaboradorNome || "Um colaborador"} enviou um atestado para aprovação.`,
      link: "/admin/documentos/atestados",
    }));

    if (notifications.length > 0) {
      await supabaseAdmin.from("notificacoes").insert(notifications);
    }

    console.log("[notify-atestado] Notificações enviadas", { count: notifications.length, atestadoId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-atestado] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});