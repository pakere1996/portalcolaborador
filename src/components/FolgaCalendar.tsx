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

      if (occupants.length > 0) {
        const status = mineHere ? "mine" : isFull ? "taken" : "available";
        const label = mineHere ? "Sua folga" : isFull ? "Lotado" : "Ocupado";
        
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status,
          occupants,
          limit,
          birthdayUser,
          label: occupants.length > 0 ? label : undefined,
          tooltip:
            `${occupants.length}/${limit} ocupado` +
            (isFull ? " (Lotado)" : "") +
            (birthdayUser ? ` | 🎂 Aniversário` : ""),
        });
        continue;
      }

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

      if (birthdayUser) {
        const mine = birthdayUser.userId === myUserId;
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status: mine ? "available" : "birthday",
          occupants,
          limit,
          birthdayUser,
          tooltip: mine
            ? `🎂 Seu aniversário! Você tem prioridade hoje.`
            : `🎂 Reservado para Aniversariante`,
        });
        continue;
      }

      result.push({
        kind: "weekend",
        date: d,
        iso,
        status: "available",
        occupants,
        limit,
        birthdayUser,
        tooltip: limit > 1 ? `Disponível (0/${limit})` : "Disponível",
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
          <div className="mb-6 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-700 px-4 py-3 text-sm flex items-center gap-3">
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
            const classes = cn(
              "aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold relative overflow-hidden border-2 transition-all duration-200",
              c.status === "available" && "bg-emerald-50 border-emerald-100 text-emerald-700 hover:scale-105 hover:shadow-md",
              c.status === "blocked" && "bg-red-50 border-red-100 text-red-700 opacity-80",
              c.status === "taken" && "bg-slate-200 border-slate-300 text-slate-600 shadow-inner",
              c.status === "mine" && "bg-blue-600 border-blue-700 text-white shadow-lg scale-105 z-10",
              c.status === "birthday" && "bg-amber-50 border-amber-200 text-amber-700",
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
                      <Cake className={cn("absolute top-1 right-1 size-3", c.status === 'mine' ? 'text-white' : 'text-amber-500')} />
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
                        c.status === 'mine' ? 'text-blue-100' : 'text-muted-foreground'
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
          <Legend color="bg-emerald-500" label="Livre" />
          <Legend color="bg-red-500" label="Bloqueado" />
          <Legend color="bg-blue-600" label="Sua Folga" />
          <Legend color="bg-amber-500" label="Aniversário" />
          <Legend color="bg-slate-400" label="Lotado" />
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