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
import { ChevronLeft, ChevronRight, Cake, Users, AlertCircle, Lock, LockOpen, CheckCircle2 } from "lucide-react";
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
  requestId?: string;
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
      blockedReason?: string;
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
  pendingRequests?: Set<string>;
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
      const isWeekend = !!type;
      const isFixedOff = !isAdmin && fixedDayOfWeek !== null && fixedDayOfWeek !== undefined && d.getDay() === fixedDayOfWeek;
      
      const limit = dayLimits?.get(iso) ?? 1;
      const occupants = occupantsByDate?.get(iso) ?? [];
      const birthdayUser = birthdayByDate?.get(iso);
      
      // Para o limite, contam tanto folgas mensais quanto folgas fixas
      const totalOccupants = occupants.filter(o => o.type === 'monthly' || o.type === 'fixed');
      const isFull = totalOccupants.length >= limit;
      
      const isMine = !!myUserId && occupants.some((o) => o.userId === myUserId && o.type === 'monthly');
      const hasPending = !!myUserId && occupants.some(o => o.userId === myUserId && o.type === 'pending');

      if (d < today) {
        result.push({ kind: "day", date: d, iso, status: "past", occupants, limit, tooltip: "Data passada" });
        continue;
      }

      // Prioridade 1: Minha folga mensal (Amarelo)
      if (!isAdmin && isMine) {
        result.push({
          kind: "day", date: d, iso, status: "mine", occupants, limit, birthdayUser,
          label: "Sua folga", tooltip: "Sua folga mensal registrada nesta data"
        });
        continue;
      }

      // Prioridade 2: Minha folga semanal fixa (Azul)
      if (!isAdmin && isFixedOff) {
        result.push({
          kind: "day", date: d, iso, status: "fixed", occupants, limit,
          label: "Semanal", tooltip: "Sua folga semanal fixa"
        });
        continue;
      }

      // Prioridade 3: Minha solicitação pendente (Roxo)
      if (!isAdmin && hasPending) {
        result.push({
          kind: "day", date: d, iso, status: "pending", occupants, limit,
          label: "Sua solicitação", tooltip: "Sua solicitação aguardando aprovação"
        });
        continue;
      }
      
      // Para Admin, mostrar se há qualquer pendência
      if (isAdmin && occupants.some(o => o.type === 'pending')) {
        result.push({
          kind: "day", date: d, iso, status: "pending", occupants, limit,
          label: "Pendente", tooltip: "Há solicitações aguardando aprovação"
        });
        continue;
      }

      if (!isAdmin && locked && isWeekend) {
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
          tooltip: `Data bloqueada: ${blockedReason}`,
          blockedReason: blockedReason
        });
        continue;
      }

      if (!isAdmin && isWeekend && birthdayUser && birthdayUser.userId !== myUserId) {
        result.push({
          kind: "day", date: d, iso, status: "birthday", occupants, limit,
          label: "Indisponível", tooltip: "Indisponível: Reservado para aniversariante"
        });
        continue;
      }

      // Se estiver lotado por outros colaboradores (mensais ou fixas)
      if (isWeekend && isFull) {
        result.push({
          kind: "day", date: d, iso, status: "taken", occupants, limit,
          label: "Indisponível", tooltip: "Limite de folgas atingido"
        });
        continue;
      }

      result.push({
        kind: "day", date: d, iso, status: isWeekend ? "available" : "weekday", occupants, limit,
        tooltip: isWeekend ? (limit > 1 ? `Disponível (${totalOccupants.length}/${limit})` : "Disponível") : undefined
      });
    }
    return result;
  }, [year, month0, occupantsByDate, manualBlocked, dayLimits, birthdayByDate, myUserId, fixedDayOfWeek, today, locked, isAdmin]);

  return (
    <TooltipProvider>
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-10 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {MONTH_NAMES[month0]} <span className="text-slate-300 font-medium">{year}</span>
          </h2>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onPrev} className="rounded-full hover:bg-slate-100 transition-colors">
              <ChevronLeft className="size-6 text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onNext} className="rounded-full hover:bg-slate-100 transition-colors">
              <ChevronRight className="size-6 text-slate-500" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-inner">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="bg-slate-50/80 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              {w}
            </div>
          ))}

          {cells.map((c, i) => {
            if (c.kind === "blank") return <div key={i} className="bg-slate-50/30 aspect-square" />;
            
            const isClickable = !!onSelectDay;
            const dayOfWeek = c.date.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isWeekend = isSunday || isSaturday;
            
            const statusStyles = {
              available: "bg-emerald-50/40 border-emerald-200/50 border-2 hover:bg-emerald-100/60",
              blocked: "bg-rose-50/80 border-rose-200 border-2",
              taken: "bg-rose-50/80 border-rose-200 border-2",
              birthday: "bg-rose-50/80 border-rose-200 border-2",
              mine: "bg-amber-100/60 border-amber-300 border-2",
              fixed: "bg-blue-50/60 border-blue-200 border-2",
              pending: "bg-violet-50/90 border-violet-400 border-2 animate-pulse",
              past: "bg-slate-50/40 text-slate-300",
              weekday: "bg-white hover:bg-slate-50/40",
            };

            const tagColors = {
              fixed: "bg-blue-100/80 text-blue-700 border-blue-200/50",
              monthly: "bg-amber-100/80 text-amber-700 border-amber-200/50",
              pending: "bg-violet-600 text-white border-violet-700 shadow-md",
            };

            const isBlocked = c.status === 'blocked' || c.status === 'taken' || c.status === 'birthday';
            const totalCount = c.kind === 'day' ? c.occupants.filter(o => o.type === 'monthly' || o.type === 'fixed').length : 0;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] md:min-h-[140px] p-3 flex flex-col relative transition-all duration-300 group border-none",
                  statusStyles[c.status],
                  c.status !== 'available' && !isBlocked && c.status !== 'pending' && c.status !== 'mine' && isSunday && c.status !== 'past' && "bg-rose-50/40",
                  c.status !== 'available' && !isBlocked && c.status !== 'pending' && c.status !== 'mine' && isSaturday && c.status !== 'past' && "bg-amber-50/40",
                  isClickable && "cursor-pointer hover:shadow-lg hover:z-10 hover:scale-[1.02]"
                )}
                onClick={() => onSelectDay?.(c.iso, { status: c.status, reason: c.tooltip })}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={cn(
                    "text-sm font-bold tracking-tight",
                    c.status === 'available' ? "text-emerald-700" : (isSunday || isSaturday) && c.status !== 'past' ? "text-slate-900" : "text-slate-400",
                    c.status === 'past' && "text-slate-200",
                    c.status === 'pending' && "text-violet-700",
                    c.status === 'mine' && "text-amber-700"
                  )}>
                    {c.date.getDate()}
                  </span>
                  <div className="flex gap-1">
                    {c.status === 'available' && (
                      <LockOpen className="size-3.5 text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.3)]" />
                    )}
                    {c.status === 'mine' && (
                      <CheckCircle2 className="size-4 text-amber-600 drop-shadow-[0_0_3px_rgba(217,119,6,0.3)]" />
                    )}
                    {c.status === 'pending' && <AlertCircle className="size-4 text-violet-600" />}
                    {isBlocked && <Lock className="size-3.5 text-rose-400" />}
                    {c.birthdayUser && <Cake className="size-3.5 text-amber-400 animate-pulse" />}
                  </div>
                </div>

                {isAdmin && c.occupants.length > 0 && (
                  <div className="flex flex-col gap-1.5 overflow-hidden">
                    {c.occupants.slice(0, 4).map((occ, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "text-[10px] px-2.5 py-1 rounded-full border truncate w-fit max-w-full font-semibold shadow-sm",
                          tagColors[occ.type]
                        )}
                      >
                        {occ.userName?.split(' ')[0]}
                      </div>
                    ))}
                    {c.occupants.length > 4 && (
                      <div className="text-[10px] text-slate-400 font-bold pl-1 flex items-center gap-1 mt-1">
                        <Users className="size-3" /> +{c.occupants.length - 4}
                      </div>
                    )}
                  </div>
                )}

                {!isAdmin && c.label && (
                  <div className={cn(
                    "mt-auto text-[10px] font-bold px-3 py-1 rounded-full border w-fit shadow-sm",
                    c.status === 'mine' ? tagColors.monthly : 
                    c.status === 'fixed' ? tagColors.fixed : 
                    c.status === 'pending' ? tagColors.pending : 'bg-slate-100 text-slate-500 border-slate-200'
                  )}>
                    {c.label}
                  </div>
                )}

                {isAdmin && isWeekend && c.status !== 'past' && (
                  <div className={cn(
                    "mt-auto text-[10px] font-bold flex items-center gap-1",
                    c.status === 'taken' ? "text-rose-600" : "text-slate-400",
                    c.status === 'mine' && "text-amber-700"
                  )}>
                    <Users className="size-3" /> {totalCount}/{c.limit}
                  </div>
                )}

                {c.status === 'available' && !isAdmin && (
                  <div className="mt-auto opacity-0 group-hover:opacity-100 transition-all transform translate-y-1 group-hover:translate-y-0">
                    <span className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Selecionar</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-8 mt-10 pt-8 border-t border-slate-100">
          <Legend color="bg-emerald-400" label="Disponível" />
          <Legend color="bg-blue-400" label="Folga Semanal" />
          <Legend color="bg-amber-400" label="Folga Mensal" />
          <Legend color="bg-violet-500" label="Pendente" />
          <Legend color="bg-rose-400" label="Bloqueado" />
        </div>
      </div>
    </TooltipProvider>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("size-2.5 rounded-full shadow-sm", color)} />
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}