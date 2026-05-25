import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-triggered endpoint. Picks a random valid weekend day for every
// approved+active funcionário who hasn't chosen a folga in the target month.
// Body (optional): { ano?: number, mes?: number }  (mes 1-12). Defaults to current month.
export const Route = createFileRoute("/api/public/hooks/sorteio-folgas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let ano: number | undefined;
        let mes: number | undefined;
        try {
          const body = (await request.json()) as { ano?: number; mes?: number };
          ano = body.ano;
          mes = body.mes;
        } catch {
          // empty body ok
        }
        const now = new Date();
        ano = ano ?? now.getFullYear();
        mes = mes ?? now.getMonth() + 1;

        const { data, error } = await supabaseAdmin.rpc("sortear_folgas_mes", {
          _ano: ano,
          _mes: mes,
        });
        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, ano, mes, atribuidas: data ?? [] }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
