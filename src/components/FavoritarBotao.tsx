import { Button } from "@/components/ui/button";
import { Star, StarOff } from "lucide-react";
import { useFavoritos } from "@/lib/useFavoritos";
import { cn } from "@/lib/utils";

interface FavoritarBotaoProps {
  rota: string;
  label: string;
  icone: string;
  className?: string;
  size?: "default" | "sm" | "icon" | "lg";
}

export function FavoritarBotao({ 
  rota, 
  label, 
  icone, 
  className, 
  size = "sm" 
}: FavoritarBotaoProps) {
  const { isFavorito, adicionarFavorito, removerFavorito } = useFavoritos();
  const favoritado = isFavorito(rota);

  const handleToggle = () => {
    if (favoritado) {
      removerFavorito(rota);
    } else {
      adicionarFavorito({ rota, label, icone });
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleToggle}
      className={cn(
        "transition-colors",
        favoritado ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-yellow-500",
        className
      )}
      title={favoritado ? "Remover dos favoritos" : "Adicionar aos favoritos"}
    >
      {favoritado ? <Star className="size-4 fill-yellow-500" /> : <StarOff className="size-4" />}
    </Button>
  );
}