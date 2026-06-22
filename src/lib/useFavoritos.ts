import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export interface Favorito {
  id: string;
  rota: string;
  label: string;
  icone: string;
  ordem: number;
}

export function useFavoritos() {
  const { user } = useAuth();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarFavoritos = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_favoritos")
        .select("*")
        .eq("admin_id", user.id)
        .order("ordem", { ascending: true });

      if (error) throw error;
      setFavoritos(data ?? []);
    } catch (error) {
      console.error("Erro ao carregar favoritos:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const adicionarFavorito = useCallback(async (item: { rota: string; label: string; icone: string }) => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("admin_favoritos")
        .insert({
          admin_id: user.id,
          rota: item.rota,
          label: item.label,
          icone: item.icone,
          ordem: favoritos.length,
        })
        .select()
        .single();

      if (error) throw error;
      setFavoritos((prev) => [...prev, data]);
      toast.success(`"${item.label}" adicionado aos favoritos!`);
    } catch (error) {
      console.error("Erro ao adicionar favorito:", error);
      toast.error("Erro ao adicionar favorito");
    }
  }, [user, favoritos.length]);

  const removerFavorito = useCallback(async (rota: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("admin_favoritos")
        .delete()
        .eq("admin_id", user.id)
        .eq("rota", rota);

      if (error) throw error;
      setFavoritos((prev) => prev.filter((f) => f.rota !== rota));
      toast.success("Favorito removido!");
    } catch (error) {
      console.error("Erro ao remover favorito:", error);
      toast.error("Erro ao remover favorito");
    }
  }, [user]);

  const isFavorito = useCallback((rota: string) => {
    return favoritos.some((f) => f.rota === rota);
  }, [favoritos]);

  useEffect(() => {
    carregarFavoritos();
  }, [carregarFavoritos]);

  return {
    favoritos,
    loading,
    adicionarFavorito,
    removerFavorito,
    isFavorito,
    carregarFavoritos,
  };
}