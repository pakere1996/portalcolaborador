// Business rules for folgas (pizzaria)

export type DateStatusKind =
  | "available"
  | "blocked"
  | "taken"
  | "mine"
  | "past"
  | "birthday"
  | "pending"
  | "fixed"
  | "swapped"
  | "weekday";

export interface DateStatus {
  status: DateStatusKind;
  reason?: string;
  label?: string;
  occupancy?: number;
  limit?: number;
}

export interface FolgaRecord {
  user_id: string;
  data: string;
  tipo?: string;
  extra?: boolean;
}

export interface ProfileRecord {
  id: string;
  folga_fixa_semana: number | null;
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

export function dayType(d: Date): "sabado" | "domingo" | null {
  const w = d.getDay();
  if (w === 6) return "sabado";
  if (w === 0) return "domingo";
  return null;
}

export function formatBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return week;
}

export function getWeekStart(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isSameWeek(d1: Date, d2: Date): boolean {
  const start1 = getWeekStart(d1);
  const start2 = getWeekStart(d2);
  return start1.getTime() === start2.getTime();
}

export function unlockDateForMonth(targetYear: number, targetMonth0: number): Date {
  const d = new Date(targetYear, targetMonth0 - 1, 15);
  return d;
}

export function isMonthUnlocked(targetYear: number, targetMonth0: number, today: Date = new Date()): boolean {
  const cur = new Date(today.getFullYear(), today.getMonth(), 1);
  const target = new Date(targetYear, targetMonth0, 1);
  if (target <= cur) return true;
  const unlock = unlockDateForMonth(targetYear, targetMonth0);
  return today >= unlock;
}

export function getMonthDays(year: number, month0: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let i = 1; i <= last; i++) days.push(new Date(year, month0, i));
  return days;
}

export function autoBlockedDatesForMonth(year: number, month0: number): { date: string; reason: string }[] {
  return [];
}

export function calculateDateStatus(params: {
  date: Date;
  myUserId: string | null;
  allFolgas?: FolgaRecord[];
  allProfiles?: ProfileRecord[];
  manualBlocked?: Map<string, { reason: string; liberada: boolean }>;
  dayLimits?: Map<string, number>;
  birthdayByDate?: Map<string, { userId: string; status?: string }>;
  pendingRequests?: { data: string; user_id?: string }[];
  canceledFolgas?: { user_id: string; data: string }[];
  isAdmin: boolean;
  locked?: { unlockDateBR: string } | null;
}): DateStatus {
  const {
    date,
    myUserId,
    allFolgas = [],
    allProfiles = [],
    manualBlocked = new Map(),
    dayLimits = new Map(),
    birthdayByDate = new Map(),
    pendingRequests = [],
    canceledFolgas = [],
    isAdmin,
    locked,
  } = params;

  const iso = ymd(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return { status: "past", reason: "Data passada" };
  }

  const type = dayType(date);
  const isWknd = !!type;

  const birthday = birthdayByDate.get(iso);
  const isMyBirthday = !isAdmin && myUserId && birthday && birthday.userId === myUserId && birthday.status === 'ativa';
  if (isMyBirthday && isWknd) {
    return { status: "available", label: "Seu aniversário", reason: "Data reservada para você", occupancy: 0, limit: 1 };
  }

  const manual = manualBlocked.get(iso);
if (manual && !manual.liberada) {
  if (isAdmin) {
    // Admin vê o bloqueio, mas pode interagir
    return { status: "blocked", reason: manual.reason, adminCanOverride: true };
  } else {
    return { status: "blocked", reason: manual.reason };
  }
}

  const myFolga = myUserId && allFolgas.find(f => f.user_id === myUserId && f.data === iso);
  if (!isAdmin && myFolga) {
    const label = myFolga.tipo === 'troca' ? "Troca Aprovada" : "Sua folga";
    return { status: myFolga.tipo === 'troca' ? "swapped" : "mine", label, reason: label };
  }

  const myProfile = allProfiles.find(p => p.id === myUserId);
  const isCanceled = myUserId && canceledFolgas.some(c => c.user_id === myUserId && c.data === iso);
  const isMyFixed = !isAdmin && myProfile?.folga_fixa_semana === date.getDay() && !isCanceled;

  if (isMyFixed) {
    const hasOtherFolgaInSameWeek = allFolgas.some(f =>
      f.user_id === myUserId &&
      f.data !== iso &&
      isSameWeek(date, parseYMD(f.data))
    );
    if (!hasOtherFolgaInSameWeek) {
      return { status: "fixed", label: "Semanal", reason: "Sua folga semanal fixa" };
    } else {
      return { status: "weekday", label: "Já folgou na semana", reason: "Você já usou sua folga nesta semana" };
    }
  }

  const hasMyPending = !isAdmin && pendingRequests.some(r => r.data === iso && r.user_id === myUserId);
  if (!isAdmin && hasMyPending) {
    return { status: "pending", label: "Pendente", reason: "Aguardando aprovação" };
  }

  if (!isAdmin && locked && isWknd) {
    return { status: "blocked", reason: `Folgas ainda não liberadas (Abre em ${locked.unlockDateBR})` };
  }

  if (!isAdmin && isWknd && birthday && birthday.userId !== myUserId && birthday.status === 'ativa') {
    return { status: "birthday", label: "Indisponível", reason: "Reservado para aniversariante" };
  }

  const limit = dayLimits.get(iso) ?? 1;
  const monthlyCount = allFolgas.filter(f =>
    f.data === iso &&
    (f.tipo === 'sabado' || f.tipo === 'domingo') &&
    f.extra !== true
  ).length;

  const totalOccupied = monthlyCount + allFolgas.filter(f => f.data === iso && f.extra === true).length +
    (allProfiles.filter(p => p.folga_fixa_semana === date.getDay() && !canceledFolgas.some(c => c.user_id === p.id && c.data === iso)).length);

  if (!isAdmin && monthlyCount >= limit) {
    return { status: "taken", label: "Lotado", reason: "Limite de folgas mensais atingido", occupancy: monthlyCount, limit };
  }

  return {
    status: isWknd ? "available" : "weekday",
    reason: isWknd ? "Disponível para seleção" : undefined,
    occupancy: monthlyCount,
    limit
  };
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];