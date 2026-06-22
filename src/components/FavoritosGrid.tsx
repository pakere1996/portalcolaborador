import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Loader2, StarOff } from "lucide-react";
import { useFavoritos } from "@/lib/useFavoritos";
import { Button } from "@/components/ui/button";
import {
  Users,
  Briefcase,
  Building2,
  Shield,
  Calendar,
  ClipboardList,
  UserCheck,
  ArrowLeftRight,
  Ban,
  FileText,
  FileWarning,
  ShieldAlert,
  MessageSquare,
  Bell,
} from "lucide-react";

const iconMap: Record<string, any> = {
  Users: Users,
  Briefcase: Briefcase,
  Building2: Building2,
  Shield: Shield,
  Calendar: Calendar,
  ClipboardList: ClipboardList,
  UserCheck: UserCheck,
  ArrowLeftRight: ArrowLeftRight,
  Ban: Ban,
  FileText: FileText,
  FileWarning: FileWarning,
  ShieldAlert: ShieldAlert,
  MessageSquare: MessageSquare,
  Bell: Bell,
};

export function FavoritosGrid() {
  const { favoritos, loading, removerFavorito } = useFavoritos();

  if (loading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="size-5 text-yellow-500" />
            Favoritos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (favoritos.length === 0) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="size-5 text-yellow-500" />
            Favoritos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-6">
            <p>Nenhum atalho favoritado ainda.</p>
            <p className="text-sm mt-1">
              Clique na ⭐ ao lado dos menus para adicionar atalhos rápidos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="size-5 text-yellow-500" />
          Atalhos Favoritos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {favoritos.map((item) => {
            const IconComponent = iconMap[item.icone] || Star;
            return (
              <div key={item.id} className="relative group">
                <Link
                  to={item.rota}
                  className="block p-3 bg-card border border-border rounded-xl hover:shadow-md hover:border-primary/50 transition-all duration-200 text-center h-full min-w-[100px]"
                >
                  <IconComponent className="size-6 mx-auto text-primary mb-1.5" />
                  <span className="text-xs font-medium line-clamp-2 leading-tight break-words">{item.label}</span>
                </Link>
                {/* Botão de remover – pode ser removido se não quiser */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 size-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500"
                  onClick={() => removerFavorito(item.rota)}
                  title="Remover dos favoritos"
                >
                  <StarOff className="size-3" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}