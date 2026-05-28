"use client";

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
import { ChevronLeft, ChevronRight, Cake, Info, Clock } from "lucide-react";
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
  type: "fixed" | "monthly" | "pending";
  origin?: string;
}

export type DayInfo =
  | { kind: "blank" }
  | {
      kind: "day";
      date: Date;
      iso: string;
      status: "available" | "blocked" | "taken" | "mine" | "past" | "birthday" | "pending" | "fixed" | "weekday";
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
  myUserId?: string | null;
  fixedDayOfWeek?: number | null;
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
    myUserId,
    fixedDayOfWeek,
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

    const result: DayInfo[] = [];
    for (let i = 0; i < lead; i++) result.push({ kind: "blank" });

    for (const d of days) {
      const type = dayType(d);
      const iso = ymd(d);
      const isFixedOff = !isAdmin && fixedDayOfWeek !== null && fixedDayOfWeek !== undefined && d.getDay() === fixedDayOfWeek;
      
      const limit = dayLimits?.get(iso) ?? 1;
      const occupants = occupantsByDate?.get(iso) ?? [];
      const birthdayUser = birthdayByDate?.get(iso);
      
      const isMine = !!myUserId && occupants.some((o) => o.userId === myUserId && o.type === 'monthly');
      const hasPending = occupants.some(o => o.type === 'pending');
      const isFull = occupants.filter(o => o.type !== 'pending').length >= limit;

      // 1. Datas Passadas
      if (d < today) {
        result.push({ kind: "day", date: d, iso, status: "past", occupants, limit, tooltip: "Data passada" });
        continue;
      }

      // 2. Minha Folga Mensal (Colaborador)
      if (!isAdmin && isMine) {
        result.push({
          kind: "day", date: d, iso, status: "mine", occupants, limit, birthdayUser,
          label: "Sua folga", tooltip: "Sua folga mensal registrada nesta data"
        });
        continue;
      }

      // 3. Folga Semanal Fixa (Colaborador)
      if (!isAdmin && isFixedOff) {
        result.push({
          kind: "day", date: d, iso, status: "fixed", occupants, limit,
          label: "Fixa", tooltip: "Sua folga semanal fixa"
        });
        continue;
      }

      // 4. Mês Bloqueado
      if (!isAdmin && locked) {
        result.push({
          kind: "day", date: d, iso, status: "blocked", occupants, limit,
          tooltip: `Folgas ainda não liberadas (Abre em ${locked.unlockDateBR})`
        });
        continue;
      }

      // 5. Bloqueios
      const manual = manualBlocked.get(iso);
      const autoReason = auto.get(iso);
      const blockedReason = (manual && !manual.liberada) ? manual.reason : (autoReason && !manual?.liberada ? autoReason : null);

      if (blockedReason) {
        result.push({
          kind: "day", date: d, iso, status: "blocked", occupants, limit,
          tooltip: `Data bloqueada: ${blockedReason}`
        });
        continue;
      }

      // 6. Prioridade de Aniversário
      if (!isAdmin && birthdayUser && birthdayUser.userId !== myUserId) {
        result.push({
          kind: "day", date: d, iso, status: "birthday", occupants, limit,
          tooltip: "Indisponível: Reservado para aniversariante"
        });
        continue;
      }

      // 7. Pendente (Admin vê laranja, Colaborador vê amarelo claro)
      if (hasPending) {
        result.push({
          kind: "day", date: d, iso, status: "pending", occupants, limit,
          label: isAdmin ? "Pendente" : "Sua solicitação", tooltip: "Há solicitações aguardando aprovação"
        });
        continue;
      }

      // 8. Lotado
      if (isFull) {
        result.push({
          kind: "day", date: d, iso, status: "taken", occupants, limit,
          label: "Indisponível", tooltip: "Limite de colaboradores atingido"
        });
        continue;
      }

      // 9. Disponível ou Dia Útil
      result.push({
        kind: "day", date: d, iso, status: type ? "available" : "weekday", occupants, limit,
        tooltip: type ? (limit > 1 ? `Disponível (${occupants.length}/${limit})` : "Disponível") : undefined
      });
    }
    return result;
  }, [year, month0, occupantsByDate, manualBlocked, dayLimits, birthdayByDate, myUserId, fixedDayOfWeek, today, locked, isAdmin]);

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

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((c, i) => {
            if (c.kind === "blank") return <div key={i} className="aspect-square" />;
            
            const isClickable = !!onSelectDay;
            
            const statusColors = {
              available: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20",
              blocked: "bg-red-500/10 border-red-500/30 text-red-600",
              taken: "bg-red-500/10 border-red-500/30 text-red-600",
              birthday: "bg-red-500/10 border-red-500/30 text-red-600",
              mine: "bg-amber-400 border-amber-500 text-amber-900 shadow-md scale-105 z-10",
              fixed: "bg-blue-600 border-blue-700 text-white shadow-sm",
              pending: "bg-orange-500/10 border-orange-500/30 text-orange-600",
              past: "bg-muted/20 border-transparent text-muted-foreground/40",
              weekday: "text-muted-foreground/40 bg-muted/5 border-transparent",
            };

            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSelectDay?.(c.iso, { status: c.status, reason: c.tooltip })}
                    className={cn(
                      "min-h-[60px] md:min-h-[100px] aspect-square rounded-xl flex flex-col items-center p-1 md:p-2 text-sm font-bold relative transition-all duration-200 border-2",
                      statusColors[c.status],
                      isClickable ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <div className="w-full flex justify-between items-start mb-1">
                      <span className="text-lg leading-none">{c.date.getDate()}</span>
                      {c.birthdayUser && <Cake className="size-3 text-amber-500" />}
                    </div>

                    {isAdmin && c.occupants.length > 0 && (
                      <div className="w-full space-y-1 overflow-hidden">
                        {c.occupants.slice(0, 3).map((occ, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "text-[8px] md:text-[10px] px-1 py-0.5 rounded truncate w-full text-left",
                              occ.type === 'fixed' ? "bg-blue-600 text-white" :
                              occ.type === 'monthly' ? "bg-amber-400 text-amber-900" :
                              "bg-orange-500 text-white"
                            )}
                          >
                            {occ.userName?.split(' ')[0]}
                          </div>
                        ))}
                        {c.occupants.length > 3 && (
                          <div className="text-[8px] text-center text-muted-foreground">+{c.occupants.length - 3}</div>
                        )}
                      </div>
                    )}

                    {!isAdmin && c.label && (
                      <span className={cn(
                        "text-[9px] truncate px-1 mt-auto max-w-full font-medium",
                        (c.status === 'mine' || c.status === 'fixed') ? 'text-current/90' : 'text-current/70'
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
          <Legend color="bg-red-500" label="Indisponível" />
          <Legend color="bg-blue-600" label="Folga Fixa" />
          <Legend color="bg-amber-400" label="Folga Mensal" />
          <Legend color="bg-orange-500" label="Pendente" />
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