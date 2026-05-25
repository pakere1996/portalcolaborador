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
import { ChevronLeft, ChevronRight, Cake } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Map data->lista de ocupantes (suporta múltiplos por dia) */
  occupantsByDate?: Map<string, DayOccupant[]>;
  /** Compatibilidade: 1 ocupante por dia */
  takenByDate?: Map<string, { userId: string; userName?: string }>;
  manualBlocked: Map<string, { reason: string; liberada: boolean }>;
  /** Limite configurado por dia (default 1) */
  dayLimits?: Map<string, number>;
  /** Prioridade de aniversário por dia */
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

    // Normaliza occupants
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
        const status = mineHere && !isFull ? "mine" : isFull ? (mineHere ? "mine" : "taken") : "available";
        const label = occupants[0].userName;
        result.push({
          kind: "weekend",
          date: d,
          iso,
          status,
          occupants,
          limit,
          birthdayUser,
          label,
          tooltip:
            `${occupants.length}/${limit} ` +
            (isFull ? "lotado" : "disponível") +
            ` — ${occupants.map((o) => o.userName ?? "ocupado").join(", ")}` +
            (birthdayUser ? ` 🎂 ${birthdayUser.userName ?? "aniversário"}` : ""),
        });
        continue;
      }

      // Sem ocupantes — checa bloqueios
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
          tooltip: blockedReason,
        });
        continue;
      }

      // Prioridade de aniversário ativa
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
            ? `🎂 Seu aniversário — você tem prioridade nesta data`
            : `🎂 Reservado para ${birthdayUser.userName ?? "aniversariante"}`,
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
        tooltip: limit > 1 ? `0/${limit} disponível` : undefined,
      });
    }
    return result;
  }, [year, month0, occupantsByDate, takenByDate, manualBlocked, dayLimits, birthdayByDate, myUserId, today]);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onPrev}>
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="text-lg md:text-xl font-semibold">
          {MONTH_NAMES[month0]} {year}
        </h2>
        <Button variant="ghost" size="icon" onClick={onNext}>
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {locked && (
        <div className="mb-4 rounded-lg bg-pending/15 border border-pending/40 text-pending-foreground/90 px-4 py-3 text-sm">
          As escolhas de folga deste mês serão liberadas em <b>{locked.unlockDateBR}</b>.
        </div>
      )}

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-muted-foreground mb-2">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1 font-medium">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (c.kind === "blank") return <div key={i} className="aspect-square" />;
          if (c.kind === "weekday") {
            return (
              <div
                key={i}
                className="aspect-square rounded-lg flex items-center justify-center text-sm text-muted-foreground/60 bg-muted/30"
              >
                {c.label}
              </div>
            );
          }
          const isClickable = !!onSelectDay && !locked;
          const classes = cn(
            "aspect-square rounded-lg flex flex-col items-center justify-center text-sm font-medium relative overflow-hidden border transition",
            c.status === "available" && "bg-available/15 border-available/40 text-available hover:bg-available/25",
            c.status === "blocked" && "bg-unavailable/15 border-unavailable/40 text-unavailable/90",
            c.status === "taken" && "bg-unavailable/15 border-unavailable/40 text-unavailable/90",
            c.status === "mine" && "bg-mine/20 border-mine text-mine",
            c.status === "birthday" && "bg-pending/15 border-pending/40 text-pending-foreground/90",
            c.status === "past" && "bg-muted/30 border-border text-muted-foreground/40",
            isClickable && "cursor-pointer",
            !isClickable && "cursor-default"
          );
          return (
            <button
              key={i}
              type="button"
              disabled={!isClickable}
              onClick={() =>
                onSelectDay?.(c.iso, {
                  status: c.status,
                  reason: c.tooltip,
                })
              }
              title={c.tooltip}
              className={classes}
            >
              {c.birthdayUser && (
                <Cake className="absolute top-0.5 right-0.5 size-3 text-pending" />
              )}
              {c.limit > 1 && (
                <span className="absolute top-0.5 left-0.5 text-[9px] px-1 rounded bg-background/60 text-foreground/70">
                  {c.occupants.length}/{c.limit}
                </span>
              )}
              <span className="text-base leading-none">{c.date.getDate()}</span>
              {c.label && (
                <span className="text-[9px] truncate px-1 mt-0.5 opacity-80 max-w-full">
                  {c.label.split(" ")[0]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-5 text-xs">
        <Legend color="bg-available" label="Disponível" />
        <Legend color="bg-unavailable" label="Indisponível" />
        <Legend color="bg-mine" label="Sua folga" />
        <Legend color="bg-pending" label="Aniversário / Pendente" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`inline-block size-3 rounded ${color}`} />
      {label}
    </div>
  );
}
