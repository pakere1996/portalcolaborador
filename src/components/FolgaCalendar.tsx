"use client";

import { useMemo } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  getMonthDays,
  calculateDateStatus,
  ymd,
  type DateStatusKind,
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
      status: DateStatusKind;
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
  dayLimits: Map<string, number>;
  birthdayByDate: Map<string, { userId: string; userName?: string }>;
  myUserId: string | null;
  allFolgas: { user_id: string; data: string }[];
  allProfiles: { id: string; folga_fixa_semana: number | null }[];
  pendingRequests: { data: string }[];
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
    allFolgas,
    allProfiles,
    pendingRequests,
    isAdmin,
    onPrev, onNext, onSelectDay, locked,
  } = props;
  
  const cells = useMemo<DayInfo[]>(() => {
    const first = new Date(year, month0, 1);
    const lead = first.getDay();
    const days = getMonthDays(year, month0);

    const result: DayInfo[] = [];
    for (let i = 0; i < lead; i++) result.push({ kind: "blank" });

    for (const d of days) {
      const iso = ymd(d);
      const isWknd = d.getDay() === 0 || d.getDay() === 6;
      
      const statusInfo = calculateDateStatus({
        date: d,
        myUserId,
        allFolgas,
        allProfiles,
        manualBlocked,
        dayLimits,
        birthdayByDate: birthdayByDate as any,
        pendingRequests,
        isAdmin: !!isAdmin,
        locked
      });

      // LOG DE DEPURAÇÃO PARA FINS DE SEMANA
      if (isWknd && !isAdmin) {
        const limit = dayLimits.get(iso) ?? 1;
        const monthlyCount = allFolgas.filter(f => f.data === iso).length;
        const fixedCount = allProfiles.filter(p => p.folga_fixa_semana === d.getDay()).length;
        const total = monthlyCount + fixedCount;

        console.log(`[Render] ${iso}:`, {
          status: statusInfo.status,
          limite: limit,
          ocupacaoTotal: total,
          folgasMensais: monthlyCount,
          folgasFixas: fixedCount,
          allFolgasCount: allFolgas.length,
          allProfilesCount: allProfiles.length
        });
      }

      result.push({
        kind: "day",
        date: d,
        iso,
        status: statusInfo.status,
        occupants: occupantsByDate?.get(iso) || [],
        limit: dayLimits.get(iso) || 1,
        label: statusInfo.label,
        tooltip: statusInfo.reason,
        birthdayUser: birthdayByDate.get(iso)
      });
    }
    
    return result;
  }, [year, month0, allFolgas, allProfiles, manualBlocked, dayLimits, birthdayByDate, myUserId, isAdmin, locked, pendingRequests, occupantsByDate]);

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

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] md:min-h-[140px] p-3 flex flex-col relative transition-all duration-300 group border-none",
                  statusStyles[c.status],
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

                {isAdmin && (isSunday || isSaturday) && c.status !== 'past' && (
                  <div className={cn(
                    "mt-auto text-[10px] font-bold flex items-center gap-1",
                    c.status === 'taken' ? "text-rose-600" : "text-slate-400",
                  )}>
                    <Users className="size-3" /> {c.occupants.filter(o => o.type !== 'pending').length}/{c.limit}
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