import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas administradores podem executar esta ação.");
}

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        newPassword: z.string().min(6).max(72),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ targetUserId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    if (data.targetUserId === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminApproveUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    if (data.approve) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          aprovacao_status: "aprovado",
          aprovado_por: context.userId,
          aprovado_em: new Date().toISOString(),
          ativo: true,
        })
        .eq("id", data.targetUserId);
      if (error) throw new Error(error.message);
    } else {
      // Recusar: marca status, desativa e remove auth user
      await supabaseAdmin
        .from("profiles")
        .update({
          aprovacao_status: "recusado",
          aprovado_por: context.userId,
          aprovado_em: new Date().toISOString(),
          ativo: false,
        })
        .eq("id", data.targetUserId);
      await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    }
    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        nome: z.string().min(1).max(120),
        cpf: z.string().regex(/^\d{11}$/),
        cargo: z.string().min(1).max(60),
        senha: z.string().min(6).max(72),
        dataAdmissao: z.string().nullable().optional(),
        dataNascimento: z.string().nullable().optional(),
        folgaFixaSemana: z.number().int().min(0).max(6).nullable().optional(),
        role: z.enum(["funcionario", "admin"]).default("funcionario"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const email = `${data.cpf}@pizzaria.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.senha,
      email_confirm: true,
      user_metadata: {
        nome: data.nome,
        cpf: data.cpf,
        cargo: data.cargo,
        criado_por_admin: true,
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar");

    const profileUpdate: {
      data_admissao?: string;
      data_nascimento?: string;
      folga_fixa_semana?: number;
    } = {};
    if (data.dataAdmissao) profileUpdate.data_admissao = data.dataAdmissao;
    if (data.dataNascimento) profileUpdate.data_nascimento = data.dataNascimento;
    if (data.folgaFixaSemana !== undefined && data.folgaFixaSemana !== null) {
      profileUpdate.folga_fixa_semana = data.folgaFixaSemana;
    }
    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", created.user.id);
    }

    if (data.role === "admin") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { ok: true, userId: created.user.id };
  });
