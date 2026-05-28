import { useMemo } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  getMonthDays,
  ymd,
  dayType,
  autoBlockedDatesForMonth,
} from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Cake, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface DayOccupant {
  userId: string;
  userName?: string;
}

export type DayInfo =
  | { kind: "blank" }
  | { kind: "weekday"; date: Date; label: string }
  | {
      kind: "weekend";
      date: Date;
      iso: string;
      status: "available" | "blocked" | "taken" | "mine" | "past" | "birthday";
      occupants: DayOccupant[];
      limit: number;
      birthdayUser?: { userId: string; userName?: string };
      label?: string;
      tooltip?: string;
    };

export interface FolgaCalendarProps {
  year: number;
  month0: number;
  occupantsByDate?: Map<string, DayOccupant[]>;
  takenByDate?: Map<string, { userId: string; userName?: string }>;
  manualBlocked: Map<string, { reason: string; liberada: boolean }>;
  dayLimits?: Map<string, number>;
  birthdayByDate?: Map<string, { userId: string; userName?: string }>;
  myUserId?: string | null;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay?: (iso: string, info: { status: string; reason?: string }) => void;
  locked?: { unlockDateBR: string } | null;
}

export function FolgaCalendar(props: FolgaCalendarProps) {
  const {
    year, month0,
    occupantsByDate, takenByDate,
    manualBlocked,
    dayLimits,
    birthdayByDate,
    myUserId,
    onPrev, onNext, onSelectDay, locked,
  } = props;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = useMemo<DayInfo[]>(() => {
    const first = new Date(year, month0, 1);
    const lead = first.getDay();
    const days = getMonthDays(year, month0);
    const auto = new Map(autoBlockedDatesForMonth(year, month0).map((b) => [b.date, b.reason]));

    const occ = new Map<string, DayOccupant[]>();
    if (occupantsByDate) {
      for (const [k, v] of occupantsByDate) occ.set(k, v);
    } else if (takenByDate) {
      for (const [k, v] of takenByDate) occ.set(k, [v]);
    }

    const result: DayInfo[] = [];
    for (let i = 0; i < lead; i++) result.push({ kind: "blank" });

    for (const d of days) {
      const type = dayType(d);
      const iso = ymd(d);
      if (!type) {
        result.push({ kind: "weekday", date: d, label: String(d.getDate()) });
        continue;
      }

      const limit = dayLimits?.get(iso) ?? 1;
      const occupants = occ.get(iso) ?? [];
      const birthdayUser = birthdayByDate?.get(iso);

      if (d < today) {
        result.push({ kind: "weekend", date: d, iso, status: "past", occupants, limit, birthdayUser });
        continue;
      }

      const mineHere = !!myUserId && occupants.some((o) => o.userId === myUserId);
      const isFull = occupants.length >= limit;

      // 1. Minha folga (Sempre azul)
      if (mineHere) {
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status: "mine",
          occupants,
          limit,
          birthdayUser,
          label: "Sua folga",
          tooltip: `Sua folga registrada (${occupants.length}/${limit})`,
        });
        continue;
      }

      // 2. Lotado (Vermelho)
      if (isFull) {
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status: "taken",
          occupants,
          limit,
          birthdayUser,
          label: "Lotado",
          tooltip: `Lotado (${occupants.length}/${limit}) — ${occupants.map(o => o.userName).join(", ")}`,
        });
        continue;
      }

      // 3. Bloqueios (Vermelho)
      const manual = manualBlocked.get(iso);
      const autoReason = auto.get(iso);
      const blockedReason =
        manual && !manual.liberada ? manual.reason : autoReason && !manual?.liberada ? autoReason : null;

      if (blockedReason) {
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status: "blocked",
          occupants,
          limit,
          birthdayUser,
          tooltip: `Bloqueado: ${blockedReason}`,
        });
        continue;
      }

      // 4. Prioridade de aniversário de outro (Vermelho para evitar confusão)
      if (birthdayUser && birthdayUser.userId !== myUserId) {
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status: "birthday", // Usaremos a cor de bloqueado no CSS
          occupants,
          limit,
          birthdayUser,
          tooltip: `🎂 Reservado para Aniversariante`,
        });
        continue;
      }

      // 5. Disponível (Verde) - Pode ter gente mas não está lotado
      result.push({
        kind: "weekend",
        date: d,
        iso,
        status: "available",
        occupants,
        limit,
        birthdayUser,
        label: occupants.length > 0 ? occupants[0].userName?.split(" ")[0] : undefined,
        tooltip: occupants.length > 0 
          ? `${occupants.length}/${limit} ocupado — ${occupants.map(o => o.userName).join(", ")}`
          : limit > 1 ? `Disponível (0/${limit})` : "Disponível",
      });
    }
    return result;
  }, [year, month0, occupantsByDate, takenByDate, manualBlocked, dayLimits, birthdayByDate, myUserId, today]);

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="icon" onClick={onPrev} className="rounded-full">
            <ChevronLeft className="size-5" />
          </Button>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            {MONTH_NAMES[month0]} <span className="text-muted-foreground font-normal">{year}</span>
          </h2>
          <Button variant="outline" size="icon" onClick={onNext} className="rounded-full">
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {locked && (
          <div className="mb-6 rounded-xl bg-pending/10 border border-pending/20 text-pending-foreground px-4 py-3 text-sm flex items-center gap-3">
            <Info className="size-4 shrink-0" />
            <span>As escolhas para este mês abrem em <b>{locked.unlockDateBR}</b>.</span>
          </div>
        )}

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((c, i) => {
            if (c.kind === "blank") return <div key={i} className="aspect-square" />;
            if (c.kind === "weekday") {
              return (
                <div
                  key={i}
                  className="aspect-square rounded-xl flex items-center justify-center text-sm text-muted-foreground/40 bg-muted/10 border border-transparent"
                >
                  {c.label}
                </div>
              );
            }
            const isClickable = !!onSelectDay && !locked;
            
            // Unificando cores: birthday (de outros), blocked e taken ficam vermelhos
            const isRed = c.status === "blocked" || c.status === "taken" || c.status === "birthday";
            
            const classes = cn(
              "aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold relative overflow-hidden border-2 transition-all duration-200",
              c.status === "available" && "bg-available/10 border-available/20 text-available hover:scale-105 hover:shadow-md",
              isRed && "bg-unavailable/10 border-unavailable/20 text-unavailable shadow-inner",
              c.status === "mine" && "bg-mine border-mine text-mine-foreground shadow-lg scale-105 z-10",
              c.status === "past" && "bg-muted/20 border-transparent text-muted-foreground/30",
              isClickable && "cursor-pointer",
              !isClickable && "cursor-default"
            );

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => onSelectDay?.(c.iso, { status: c.status, reason: c.tooltip })}
                    className={classes}
                  >
                    {c.birthdayUser && (
                      <Cake className={cn("absolute top-1 right-1 size-3", c.status === 'mine' ? 'text-white' : 'text-pending')} />
                    )}
                    {c.limit > 1 && c.status !== 'past' && (
                      <span className={cn(
                        "absolute top-1 left-1 text-[9px] px-1 rounded font-black",
                        c.status === 'mine' ? 'bg-white/20 text-white' : 'bg-black/10 text-foreground/80'
                      )}>
                        {c.occupants.length}/{c.limit}
                      </span>
                    )}
                    <span className="text-lg leading-none">{c.date.getDate()}</span>
                    {c.label && (
                      <span className={cn(
                        "text-[9px] truncate px-1 mt-1 max-w-full font-medium",
                        c.status === 'mine' ? 'text-white/90' : 'text-muted-foreground'
                      )}>
                        {c.label}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                {c.tooltip && (
                  <TooltipContent className="max-w-[200px] text-center">
                    <p>{c.tooltip}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-border text-[11px] font-bold uppercase tracking-tight">
          <Legend color="bg-available" label="Livre" />
          <Legend color="bg-unavailable" label="Bloqueado / Lotado" />
          <Legend color="bg-mine" label="Sua Folga" />
          <Legend color="bg-pending" label="Aniversário" />
        </div>
      </div>
    </TooltipProvider>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <span className={`inline-block size-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}