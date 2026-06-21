"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS,
  getMonthDays,
  calculateDateStatus,
  ymd,
  monthKey,
  parseYMD,
  type DateStatusKind,
  type FolgaRecord,
  type ProfileRecord,
} from "@/lib/folga-rules";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Cake,
  Users,
  AlertCircle,
  Lock,
  LockOpen,
  CheckCircle2,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
      occupancy: number;
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
  birthdayByDate?: Map<string, { userId: string; userName?: string; status?: string }>;
  myUserId: string | null;
  allFolgas: FolgaRecord[];
  allProfiles: ProfileRecord[];
  pendingRequests: { data: string; user_id?: string }[];
  isAdmin?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay?: (iso: string, info?: { status: string; reason?: string }) => void;
  locked?: { unlockDateBR: string } | null;
  currentMonthKey?: string;
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);
  return matches;
};

const DIAS_SEMANA_ABR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function FolgaCalendar(props: FolgaCalendarProps) {
  const {
    year,
    month0,
    occupantsByDate,
    manualBlocked,
    dayLimits,
    birthdayByDate,
    myUserId,
    allFolgas,
    allProfiles,
    pendingRequests,
    isAdmin = false,
    onPrev,
    onNext,
    onSelectDay,
    locked,
    currentMonthKey,
  } = props;

  const isMobile = useMediaQuery("(max-width: 768px)");
  const hoje = new Date();
  const hojeStr = ymd(hoje);

  const hasMonthlyFolga = useMemo(() => {
    if (!myUserId || !currentMonthKey) return false;
    return allFolgas.some(
      (f) =>
        f.user_id === myUserId &&
        monthKey(parseYMD(f.data)) === currentMonthKey &&
        (f.tipo === "sabado" || f.tipo === "domingo") &&
        f.extra !== true
    );
  }, [allFolgas, myUserId, currentMonthKey]);

  const userFolgaData = useMemo(() => {
    if (!myUserId || !currentMonthKey) return null;
    const folga = allFolgas.find(
      (f) =>
        f.user_id === myUserId &&
        monthKey(parseYMD(f.data)) === currentMonthKey &&
        (f.tipo === "sabado" || f.tipo === "domingo") &&
        f.extra !== true
    );
    return folga?.data || null;
  }, [allFolgas, myUserId, currentMonthKey]);

  const userFolgaPassou = useMemo(() => {
    if (!userFolgaData) return false;
    return userFolgaData < hojeStr;
  }, [userFolgaData, hojeStr]);

  const cells = useMemo<DayInfo[]>(() => {
    const first = new Date(year, month0, 1);
    const lead = first.getDay();
    const days = getMonthDays(year, month0);

    const bdayMap =
      birthdayByDate ||
      new Map<string, { userId: string; userName?: string; status?: string }>();
    const result: DayInfo[] = [];

    for (let i = 0; i < lead; i++) result.push({ kind: "blank" });

    for (const d of days) {
      const iso = ymd(d);
      const statusInfo = calculateDateStatus({
        date: d,
        myUserId,
        allFolgas,
        allProfiles,
        manualBlocked,
        dayLimits,
        birthdayByDate: bdayMap as any,
        pendingRequests,
        isAdmin,
        locked,
      });

      const occupants = occupantsByDate?.get(iso) || [];

      result.push({
        kind: "day",
        date: d,
        iso,
        status: statusInfo.status,
        occupants,
        limit: statusInfo.limit || 1,
        occupancy: statusInfo.occupancy || 0,
        label: statusInfo.label,
        tooltip: statusInfo.reason,
        birthdayUser: bdayMap.get(iso),
      });
    }

    return result;
  }, [
    year,
    month0,
    allFolgas,
    allProfiles,
    manualBlocked,
    dayLimits,
    birthdayByDate,
    myUserId,
    isAdmin,
    locked,
    pendingRequests,
    occupantsByDate,
  ]);

  const statusStyles: Record<DateStatusKind, string> = {
    available: "bg-emerald-50/40 border-emerald-200/50 border-2 hover:bg-emerald-100/60",
    blocked: "bg-rose-50/80 border-rose-200 border-2",
    taken: "bg-rose-50/80 border-rose-200 border-2",
    birthday: "bg-rose-50/80 border-rose-200 border-2",
    mine: "bg-amber-100/60 border-amber-300 border-2",
    fixed: "bg-blue-50/60 border-blue-200 border-2",
    pending: "bg-violet-50/90 border-violet-400 border-2",
    past: "bg-slate-50/40 text-slate-300",
    weekday: "bg-white hover:bg-slate-50/40",
    swapped: "bg-amber-100/60 border-amber-300 border-2",
  };

  const tagColors = {
    fixed: "bg-blue-100/80 text-blue-700 border-blue-200/50",
    monthly: "bg-amber-100/80 text-amber-700 border-amber-200/50",
    pending: "bg-violet-600 text-white border-violet-700 shadow-md",
  };

  // Renderização mobile
  const renderMobileCalendar = () => {
    const days = getMonthDays(year, month0);
    const monthName = new Date(year, month0).toLocaleString("pt-BR", {
      month: "long",
    });
    const yearStr = year;

    return (
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={onPrev}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="font-bold text-sm capitalize">
              {monthName} {yearStr}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={onNext}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {days.filter((d) => d.getDay() === 0 || d.getDay() === 6).length} dias
            úteis
          </span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
          {cells.map((c) => {
            if (c.kind === "blank") return null;
            const hasMyFolga = c.occupants.some(
              (occ) => occ.userId === myUserId
            );
            const isWeekend = c.date.getDay() === 0 || c.date.getDay() === 6;
            const diaSemana = DIAS_SEMANA_ABR[c.date.getDay()];
            const isPast = c.status === "past";
            const isUserFolgaPassada = isWeekend && hasMyFolga && isPast;

            return (
              <div
                key={c.iso}
                className={cn(
                  "px-4 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer",
                  isUserFolgaPassada && "opacity-60 cursor-not-allowed"
                )}
                onClick={() => {
                  if (isUserFolgaPassada) {
                    toast.warning(
                      "Sua folga deste mês já foi utilizada e não pode ser alterada."
                    );
                    return;
                  }
                  onSelectDay?.(c.iso, {
                    status: c.status,
                    reason: c.tooltip,
                  });
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-slate-500 w-8">
                        {diaSemana}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-bold",
                          isWeekend ? "text-slate-900" : "text-slate-400",
                          isPast && "text-slate-300"
                        )}
                      >
                        {c.date.getDate()}
                      </span>
                      {/* Tags para usuário comum */}
                      {!isAdmin && (
                        <>
                          {c.status === "blocked" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 h-5"
                            >
                              Bloqueado
                            </Badge>
                          )}
                          {c.status === "taken" && isWeekend && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 h-5"
                            >
                              Lotado
                            </Badge>
                          )}
                          {c.status === "available" && isWeekend && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200 px-1.5 py-0 h-5"
                            >
                              Disponível
                            </Badge>
                          )}
                          {hasMyFolga && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-amber-50 text-amber-600 border-amber-200 px-1.5 py-0 h-5"
                            >
                              Minha Folga
                            </Badge>
                          )}
                        </>
                      )}
                      {/* Tags para admin */}
                      {isAdmin && (
                        <>
                          {c.status === "blocked" && (
                            <Badge
                              variant="outline"
                              className="text-[9px] bg-rose-50 text-rose-600 border-rose-200 px-1.5 py-0 h-5"
                            >
                              Bloqueado
                            </Badge>
                          )}
                          {isWeekend && (
                            <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-1.5 py-0 h-5">
                              {c.occupancy}/{c.limit}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>

                    {/* Renderização de ocupantes: admin vê nomes, usuário comum NÃO */}
                    {isAdmin && c.occupants.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 ml-8">
                        {c.occupants.map((occ, idx) => {
                          const nome = occ.userName?.split(" ")[0] || "Colaborador";
                          return (
                            <span
                              key={idx}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]",
                                occ.type === "fixed"
                                  ? "bg-blue-50 text-blue-600"
                                  : occ.type === "monthly"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-orange-50 text-orange-600"
                              )}
                              title={occ.userName}
                            >
                              {nome}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Para usuário comum: não exibe nomes, apenas a tag "Minha Folga" já aparece acima */}
                    {!isAdmin && hasMyFolga && (
                      <div className="mt-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 inline-block ml-8">
                        {c.label || "Minha Folga"}
                        {isPast && isWeekend && " (Utilizada)"}
                      </div>
                    )}
                  </div>
                  <ChevronRightIcon className="size-4 text-slate-300 shrink-0 mt-0.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Versão Desktop (grid)
  if (isMobile) {
    return renderMobileCalendar();
  }

  return (
    <TooltipProvider>
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-10 shadow-sm">
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            {MONTH_NAMES[month0]}{" "}
            <span className="text-slate-300 font-medium">{year}</span>
          </h2>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              className="rounded-full hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="size-6 text-slate-500" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              className="rounded-full hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="size-6 text-slate-500" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden shadow-inner">
          {WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              className="bg-slate-50/80 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]"
            >
              {w}
            </div>
          ))}

          {cells.map((c, i) => {
            if (c.kind === "blank") {
              return <div key={i} className="bg-slate-50/30 aspect-square" />;
            }

            const isClickable = !!onSelectDay;
            const dayOfWeek = c.date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const hasMyFolga = c.occupants.some(
              (occ) => occ.userId === myUserId
            );
            const isPast = c.status === "past";
            const isUserFolgaPassada = isWeekend && hasMyFolga && isPast;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[100px] md:min-h-[140px] p-3 flex flex-col relative transition-all duration-300 group border-none",
                  statusStyles[c.status],
                  isClickable && "cursor-pointer hover:shadow-lg hover:z-10 hover:scale-[1.02]",
                  isUserFolgaPassada && "opacity-60 cursor-not-allowed"
                )}
                onClick={() => {
                  if (isUserFolgaPassada) {
                    toast.warning(
                      "Sua folga deste mês já foi utilizada e não pode ser alterada."
                    );
                    return;
                  }
                  onSelectDay?.(c.iso, {
                    status: c.status,
                    reason: c.tooltip,
                  });
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "text-sm font-bold tracking-tight",
                        c.status === "available"
                          ? "text-emerald-700"
                          : isWeekend && c.status !== "past"
                          ? "text-slate-900"
                          : "text-slate-400",
                        c.status === "past" && "text-slate-300",
                        c.status === "pending" && "text-violet-700",
                        c.status === "mine" && "text-amber-700",
                        c.status === "swapped" && "text-amber-700"
                      )}
                    >
                      {c.date.getDate()}
                    </span>
                    {/* Tags para usuário comum */}
                    {!isAdmin && (
                      <>
                        {c.status === "blocked" && (
                          <span className="text-[9px] font-black mt-0.5 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                            Bloqueado
                          </span>
                        )}
                        {c.status === "taken" && isWeekend && (
                          <span className="text-[9px] font-black mt-0.5 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                            Lotado
                          </span>
                        )}
                        {c.status === "available" && isWeekend && (
                          <span className="text-[9px] font-black mt-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Disponível
                          </span>
                        )}
                        {hasMyFolga && (
                          <span className="text-[9px] font-black mt-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200">
                            Minha Folga
                          </span>
                        )}
                      </>
                    )}
                    {/* Para admin: contagem e ocupantes */}
                    {isAdmin && isWeekend && (
                      <span
                        className={cn(
                          "text-[9px] font-black mt-0.5 px-1.5 py-0.5 rounded-md border",
                          c.occupancy >= c.limit
                            ? "bg-rose-100 text-rose-700 border-rose-200"
                            : c.occupancy >= c.limit * 0.7
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-emerald-100 text-emerald-700 border-emerald-200"
                        )}
                      >
                        {c.occupancy}/{c.limit}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {c.status === "available" && !isAdmin && (
                      <LockOpen className="size-3.5 text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.3)]" />
                    )}
                    {(c.status === "mine" ||
                      c.status === "swapped" ||
                      hasMyFolga) && (
                      <CheckCircle2 className="size-4 text-amber-600 drop-shadow-[0_0_3px_rgba(217,119,6,0.3)]" />
                    )}
                    {c.status === "pending" && (
                      <AlertCircle className="size-4 text-violet-600" />
                    )}
                    {c.status === "blocked" && !isAdmin && (
                      <Lock className="size-3.5 text-rose-400" />
                    )}
                    {c.birthdayUser && (
                      <Cake className="size-3.5 text-amber-400 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Ocupantes: apenas admin vê nomes */}
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
                        {occ.userName?.split(" ")[0]}
                      </div>
                    ))}
                    {c.occupants.length > 4 && (
                      <div className="text-[10px] text-slate-400 font-bold pl-1 flex items-center gap-1 mt-1">
                        <Users className="size-3" /> +{c.occupants.length - 4}
                      </div>
                    )}
                  </div>
                )}

                {/* Para usuário comum: não exibe nada de ocupantes (apenas "Minha Folga" já está acima) */}
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
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}