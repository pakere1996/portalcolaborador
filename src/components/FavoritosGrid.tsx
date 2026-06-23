import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Loader2, Trash2 } from "lucide-react";
import { useFavoritos, type Favorito } from "@/lib/useFavoritos";
import { cn } from "@/lib/utils";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// 🔥 Card arrastável (com transição suave da versão que funcionava)
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
    transition: transition || 'transform 200ms ease',
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1 : 0,
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

// 🔥 Overlay do card arrastado
function DragOverlayCard({ favorito }: { favorito: Favorito }) {
  const IconComponent = iconMap[favorito.icone] || StarIcon;
  return (
    <Card className="border-primary shadow-lg ring-2 ring-primary/50 bg-white scale-105">
      <CardContent className="p-4 flex items-center gap-3">
        <IconComponent className="size-5 text-primary shrink-0" />
        <span className="font-medium text-sm">{favorito.label}</span>
      </CardContent>
    </Card>
  );
}

// 🔥 Lixeira (droppable) – posicionada dentro do card
function TrashZone({ isDragging }: { isDragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "trash",
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-3 right-3 z-10 rounded-full p-2 transition-all duration-300",
        isDragging
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-0 pointer-events-none",
        isOver
          ? "bg-red-500 text-white scale-110 ring-4 ring-red-300 shadow-lg"
          : "bg-red-100 text-red-600"
      )}
    >
      <Trash2 className="size-5" />
      {isOver && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded shadow whitespace-nowrap">
          Solte para excluir
        </span>
      )}
    </div>
  );
}

export function FavoritosGrid() {
  const { favoritos, loading, reordenarFavoritos, removerFavorito } = useFavoritos();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    setIsDragging(true);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    // 🔥 Se soltou sobre a lixeira, remover o favorito
    if (over?.id === "trash") {
      const favorito = favoritos.find((f) => f.id === active.id);
      if (favorito) {
        removerFavorito(favorito.rota);
      }
      return;
    }

    // 🔥 Reordenação normal (com rectSortingStrategy)
    if (active.id !== over?.id && over) {
      const oldIndex = favoritos.findIndex((f) => f.id === active.id);
      const newIndex = favoritos.findIndex((f) => f.id === over.id);
      const novoArray = arrayMove(favoritos, oldIndex, newIndex);
      reordenarFavoritos(novoArray);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setIsDragging(false);
  };

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
    <Card className="border-border shadow-sm relative">
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
            strategy={rectSortingStrategy} // 🔥 Mantido da versão que funcionava
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {favoritos.map((fav) => (
                <SortableFavoritoCard key={fav.id} favorito={fav} />
              ))}
            </div>
          </SortableContext>

          {/* 🔥 Lixeira dentro do card */}
          <TrashZone isDragging={isDragging} />

          <DragOverlay
            dropAnimation={{
              duration: 300,
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.3',
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