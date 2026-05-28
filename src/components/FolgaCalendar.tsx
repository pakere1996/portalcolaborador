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
import { ChevronLeft, ChevronRight, Cake, Info, Users } from "lucide-react";
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

      if (d < today) {
        result.push({ kind: "day", date: d, iso, status: "past", occupants, limit, tooltip: "Data passada" });
        continue;
      }

      if (!isAdmin && isMine) {
        result.push({
          kind: "day", date: d, iso, status: "mine", occupants, limit, birthdayUser,
          label: "Sua folga", tooltip: "Sua folga mensal registrada nesta data"
        });
        continue;
      }

      if (!isAdmin && isFixedOff) {
        result.push({
          kind: "day", date: d, iso, status: "fixed", occupants, limit,
          label: "Fixa", tooltip: "Sua folga semanal fixa"
        });
        continue;
      }

      if (!isAdmin && locked) {
        result.push({
          kind: "day", date: d, iso, status: "blocked", occupants, limit,
          tooltip: `Folgas ainda não liberadas (Abre em ${locked.unlockDateBR})`
        });
        continue;
      }

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

      if (!isAdmin && birthdayUser && birthdayUser.userId !== myUserId) {
        result.push({
          kind: "day", date: d, iso, status: "birthday", occupants, limit,
          tooltip: "Indisponível: Reservado para aniversariante"
        });
        continue;
      }

      if (hasPending) {
        result.push({
          kind: "day", date: d, iso, status: "pending", occupants, limit,
          label: isAdmin ? "Pendente" : "Sua solicitação", tooltip: "Há solicitações aguardando aprovação"
        });
        continue;
      }

      if (isFull) {
        result.push({
          kind: "day", date: d, iso, status: "taken", occupants, limit,
          label: "Indisponível", tooltip: "Limite de colaboradores atingido"
        });
        continue;
      }

      result.push({
        kind: "day", date: d, iso, status: type ? "available" : "weekday", occupants, limit,
        tooltip: type ? (limit > 1 ? `Disponível (${occupants.length}/${limit})` : "Disponível") : undefined
      });
    }
    return result;
  }, [year, month0, occupantsByDate, manualBlocked, dayLimits, birthdayByDate, myUserId, fixedDayOfWeek, today, locked, isAdmin]);

  return (
    <TooltipProvider>
      <div className="bg-white border border-slate-200 rounded-3xl p-4 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-slate-900">
              {MONTH_NAMES[month0]} <span className="text-slate-400 font-medium">{year}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onPrev} className="rounded-full hover:bg-slate-100">
              <ChevronLeft className="size-5 text-slate-600" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNext} className="rounded-full hover:bg-slate-100">
              <ChevronRight className="size-5 text-slate-600" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="bg-slate-50 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {w}
            </div>
          ))}

          {cells.map((c, i) => {
            if (c.kind === "blank") return <div key={i} className="bg-slate-50/50 aspect-square" />;
            
            const isClickable = !!onSelectDay;
            
            const statusStyles = {
              available: "bg-white hover:bg-emerald-50/30",
              blocked: "bg-slate-50/80 text-slate-400",
              taken: "bg-slate-50/80 text-slate-400",
              birthday: "bg-slate-50/80 text-slate-400",
              mine: "bg-amber-50/50",
              fixed: "bg-blue-50/50",
              pending: "bg-orange-50/50",
              past: "bg-slate-50/30 text-slate-300",
              weekday: "bg-white hover:bg-slate-50/50",
            };

            const tagColors = {
              fixed: "bg-blue-100 text-blue-700 border-blue-200",
              monthly: "bg-amber-100 text-amber-700 border-amber-200",
              pending: "bg-orange-100 text-orange-700 border-orange-200",
            };

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[80px] md:min-h-[120px] bg-white p-2 flex flex-col relative transition-all duration-200 group",
                  statusStyles[c.status],
                  isClickable && "cursor-pointer"
                )}
                onClick={() => onSelectDay?.(c.iso, { status: c.status, reason: c.tooltip })}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={cn(
                    "text-xs font-bold",
                    c.status === 'past' ? 'text-slate-300' : 'text-slate-500'
                  )}>
                    {c.date.getDate()}
                  </span>
                  {c.birthdayUser && <Cake className="size-3 text-amber-400" />}
                </div>

                {isAdmin && c.occupants.length > 0 && (
                  <div className="flex flex-col gap-1 overflow-hidden">
                    {c.occupants.slice(0, 3).map((occ, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full border truncate w-fit max-w-full font-medium",
                          tagColors[occ.type]
                        )}
                      >
                        {occ.userName?.split(' ')[0]}
                      </div>
                    ))}
                    {c.occupants.length > 3 && (
                      <div className="text-[9px] text-slate-400 font-medium pl-1 flex items-center gap-1">
                        <Users className="size-2" /> +{c.occupants.length - 3}
                      </div>
                    )}
                  </div>
                )}

                {!isAdmin && c.label && (
                  <div className={cn(
                    "mt-auto text-[9px] font-bold px-2 py-0.5 rounded-full border w-fit",
                    c.status === 'mine' ? tagColors.monthly : 
                    c.status === 'fixed' ? tagColors.fixed : 
                    c.status === 'pending' ? tagColors.pending : 'bg-slate-100 text-slate-500 border-slate-200'
                  )}>
                    {c.label}
                  </div>
                )}

                {c.status === 'available' && !isAdmin && (
                  <div className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-tighter">Selecionar</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-slate-100">
          <Legend color="bg-emerald-400" label="Disponível" />
          <Legend color="bg-blue-400" label="Folga Fixa" />
          <Legend color="bg-amber-400" label="Folga Mensal" />
          <Legend color="bg-orange-400" label="Pendente" />
          <Legend color="bg-slate-300" label="Indisponível" />
        </div>
      </div>
    </TooltipProvider>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("size-2 rounded-full", color)} />
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}