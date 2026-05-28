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
      status: "available" | "blocked" | "taken" | "mine" | "past" | "birthday" | "pending";
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
  manualBlocked: Map<string, { reason: string; liberada: boolean }>;
  dayLimits?: Map<string, number>;
  birthdayByDate?: Map<string, { userId: string; userName?: string }>;
  pendingRequests?: Set<string>;
  myUserId?: string | null;
  isAdmin?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay?: (iso: string, info: { status: string; reason?: string }) => void;
  locked?: { unlockDateBR: string } | null;
}

export function FolgaCalendar(props: FolgaCalendarProps) {
  const {
    year, month0,
    occupantsByDate,
    manualBlocked,
    dayLimits,
    birthdayByDate,
    pendingRequests,
    myUserId,
    isAdmin,
    onPrev, onNext, onSelectDay, locked,
  } = props;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = useMemo<DayInfo[]>(() => {
    const first = new Date(year, month0, 1);
    const lead = first.getDay();
    const days = getMonthDays(year, month0);
    const auto = new Map(autoBlockedDatesForMonth(year, month0).map((b) => [b.date, b.reason]));

    const myFolgaThisMonth = Array.from(occupantsByDate?.values() || []).some(occList => 
      occList.some(o => o.userId === myUserId)
    );

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
      const occupants = occupantsByDate?.get(iso) ?? [];
      const birthdayUser = birthdayByDate?.get(iso);
      const isMine = !!myUserId && occupants.some((o) => o.userId === myUserId);
      const isFull = occupants.length >= limit;
      const isPending = pendingRequests?.has(iso);

      // 1. Datas Passadas (Cinza)
      if (d < today) {
        result.push({ kind: "weekend", date: d, iso, status: "past", occupants, limit, tooltip: "Data passada" });
        continue;
      }

      // 2. Mês Bloqueado (Vermelho)
      if (locked) {
        result.push({
          kind: "weekend", date: d, iso, status: "blocked", occupants, limit,
          tooltip: `Folgas ainda não liberadas (Abre em ${locked.unlockDateBR})`
        });
        continue;
      }

      // 3. Minha Folga (Azul/Destaque)
      if (isMine) {
        result.push({
          kind: "weekend", date: d, iso, status: "mine", occupants, limit, birthdayUser,
          label: "Sua folga", tooltip: "Sua folga registrada nesta data"
        });
        continue;
      }

      // 4. Solicitação Pendente (Amarelo)
      if (isPending) {
        result.push({
          kind: "weekend", date: d, iso, status: "pending", occupants, limit,
          label: "Pendente", tooltip: "Você tem uma solicitação pendente para esta data"
        });
        continue;
      }

      // 5. Bloqueios Manuais ou Automáticos (Vermelho)
      const manual = manualBlocked.get(iso);
      const autoReason = auto.get(iso);
      const blockedReason = (manual && !manual.liberada) ? manual.reason : (autoReason && !manual?.liberada ? autoReason : null);

      if (blockedReason) {
        result.push({
          kind: "weekend", date: d, iso, status: "blocked", occupants, limit,
          tooltip: `Data bloqueada: ${blockedReason}`
        });
        continue;
      }

      // 6. Prioridade de Aniversário de Outro (Vermelho)
      if (birthdayUser && birthdayUser.userId !== myUserId) {
        result.push({
          kind: "weekend", date: d, iso, status: "birthday", occupants, limit,
          tooltip: "Indisponível: Reservado para aniversariante"
        });
        continue;
      }

      // 7. Lotado (Vermelho)
      if (isFull) {
        result.push({
          kind: "weekend", date: d, iso, status: "taken", occupants, limit,
          label: "Lotado", tooltip: "Limite de colaboradores atingido"
        });
        continue;
      }

      // 8. Já possui folga no mês (Vermelho para as outras datas)
      if (myFolgaThisMonth && !isAdmin) {
        result.push({
          kind: "weekend", date: d, iso, status: "blocked", occupants, limit,
          tooltip: "Você já possui uma folga marcada neste mês"
        });
        continue;
      }

      // 9. Disponível (Verde)
      result.push({
        kind: "weekend", date: d, iso, status: "available", occupants, limit,
        tooltip: limit > 1 ? `Disponível (${occupants.length}/${limit})` : "Disponível para seleção"
      });
    }
    return result;
  }, [year, month0, occupantsByDate, manualBlocked, dayLimits, birthdayByDate, pendingRequests, myUserId, today, locked, isAdmin]);

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
          <div className="mb-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 text-sm flex items-center gap-3">
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
                  className="aspect-square rounded-xl flex items-center justify-center text-sm text-muted-foreground/40 bg-muted/5"
                >
                  {c.label}
                </div>
              );
            }
            
            const isClickable = !!onSelectDay && (isAdmin || (c.status !== "past" && c.status !== "blocked" && c.status !== "taken" && c.status !== "birthday"));
            
            const statusColors = {
              available: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20",
              blocked: "bg-red-500/10 border-red-500/30 text-red-600",
              taken: "bg-red-500/10 border-red-500/30 text-red-600",
              birthday: "bg-red-500/10 border-red-500/30 text-red-600",
              mine: "bg-blue-600 border-blue-700 text-white shadow-md scale-105 z-10",
              pending: "bg-amber-500/10 border-amber-500/30 text-amber-600",
              past: "bg-muted/20 border-transparent text-muted-foreground/40",
            };

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelectDay?.(c.iso, { status: c.status, reason: c.tooltip })}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold relative transition-all duration-200 border-2",
                      statusColors[c.status],
                      isClickable ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    {c.birthdayUser && (
                      <Cake className={cn("absolute top-1 right-1 size-3", c.status === 'mine' ? 'text-white' : 'text-amber-500')} />
                    )}
                    <span className="text-lg leading-none">{c.date.getDate()}</span>
                    {c.label && (
                      <span className={cn(
                        "text-[9px] truncate px-1 mt-1 max-w-full font-medium",
                        c.status === 'mine' ? 'text-white/90' : 'text-current/70'
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

        <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-border text-[10px] font-bold uppercase tracking-tight">
          <Legend color="bg-emerald-500" label="Disponível" />
          <Legend color="bg-red-500" label="Indisponível / Lotado" />
          <Legend color="bg-amber-500" label="Solicitação Pendente" />
          <Legend color="bg-blue-600" label="Sua Folga" />
          <Legend color="bg-muted" label="Passado" />
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