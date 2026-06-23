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

  // Carregar favoritos do banco
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

  // Adicionar um favorito (recebe objeto com rota, label, icone)
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

  // 🔥 NOVO: Reordenar favoritos (drag-and-drop)
  const reordenarFavoritos = useCallback(async (novosFavoritos: Favorito[]) => {
    if (!user) return;

    // Atualiza estado local imediatamente para feedback visual
    setFavoritos(novosFavoritos);

    // Prepara os updates com a nova ordem
    const updates = novosFavoritos.map((fav, index) => ({
      id: fav.id,
      ordem: index,
    }));

    try {
      // Executa todas as atualizações em lote
      await Promise.all(
        updates.map(({ id, ordem }) =>
          supabase
            .from("admin_favoritos")
            .update({ ordem })
            .eq("id", id)
        )
      );
    } catch (error) {
      console.error("Erro ao reordenar favoritos:", error);
      toast.error("Erro ao salvar nova ordem");
      // Recarrega para restaurar consistência
      carregarFavoritos();
    }
  }, [user, carregarFavoritos]);

  // 🔥 REMOVIDO: removerFavorito – não será mais usado no grid

  // Verifica se uma rota já está favoritada
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
    isFavorito,
    carregarFavoritos,
    reordenarFavoritos, // 🔥 exporta a nova função
  };
}