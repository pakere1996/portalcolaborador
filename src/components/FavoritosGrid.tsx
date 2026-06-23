import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Loader2 } from "lucide-react";
import { useFavoritos, type Favorito } from "@/lib/useFavoritos";
import { cn } from "@/lib/utils";

// Importações do dnd-kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Mapeamento de ícones (já existente)
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
  Coins,
  ListChecks,
  Gavel,
  Stethoscope,
  Clock,
  Star as StarIcon,
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
  Coins: Coins,
  ListChecks: ListChecks,
  Gavel: Gavel,
  Stethoscope: Stethoscope,
  Clock: Clock,
};

// 🔥 Componente de card arrastável (sem o grip)
function SortableFavoritoCard({ favorito }: { favorito: Favorito }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: favorito.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = iconMap[favorito.icone] || StarIcon;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "border-border shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
          isDragging && "shadow-lg ring-2 ring-primary/50"
        )}
      >
        <Link to={favorito.rota} className="block" onClick={(e) => e.stopPropagation()}>
          <CardContent className="p-4 flex items-center gap-3">
            <IconComponent className="size-5 text-primary shrink-0" />
            <span className="font-medium text-sm line-clamp-2 break-words">{favorito.label}</span>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}

// 🔥 Componente que aparece enquanto está sendo arrastado (overlay)
function DragOverlayCard({ favorito }: { favorito: Favorito }) {
  const IconComponent = iconMap[favorito.icone] || StarIcon;
  return (
    <Card className="border-primary shadow-lg ring-2 ring-primary/50 bg-white">
      <CardContent className="p-4 flex items-center gap-3">
        <IconComponent className="size-5 text-primary shrink-0" />
        <span className="font-medium text-sm">{favorito.label}</span>
      </CardContent>
    </Card>
  );
}

export function FavoritosGrid() {
  const { favoritos, loading, reordenarFavoritos } = useFavoritos();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // 🔥 Atraso de 1 segundo para iniciar o arrasto
        delay: 1000,
        tolerance: 5, // tolerância de movimento durante o delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    if (active.id !== over.id) {
      const oldIndex = favoritos.findIndex((f) => f.id === active.id);
      const newIndex = favoritos.findIndex((f) => f.id === over.id);
      const novoArray = arrayMove(favoritos, oldIndex, newIndex);
      reordenarFavoritos(novoArray);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Encontra o favorito que está sendo arrastado
  const activeFavorito = favoritos.find((f) => f.id === activeId);

  if (loading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="size-5 text-yellow-500" />
            Atalhos Favoritos
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
            Atalhos Favoritos
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
          <span className="text-xs font-normal text-muted-foreground ml-2">
            (pressione para reordenar)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={favoritos.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {favoritos.map((fav) => (
                <SortableFavoritoCard key={fav.id} favorito={fav} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.4',
                  },
                },
              }),
            }}
          >
            {activeFavorito ? <DragOverlayCard favorito={activeFavorito} /> : null}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}