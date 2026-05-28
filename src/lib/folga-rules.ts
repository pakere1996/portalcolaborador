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
  | "weekday";

export interface DateStatus {
  status: DateStatusKind;
  reason?: string;
  label?: string;
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

export function firstWeekendAfterDay5(year: number, month0: number): string[] {
  let d = new Date(year, month0, 6);
  while (d.getDay() !== 6) {
    d = new Date(year, month0, d.getDate() + 1);
  }
  const sat = ymd(d);
  const sun = ymd(new Date(year, month0, d.getDate() + 1));
  return [sat, sun];
}

export function autoBlockedDatesForMonth(year: number, month0: number): { date: string; reason: string }[] {
  const result: { date: string; reason: string }[] = [];
  const [sat, sun] = firstWeekendAfterDay5(year, month0);
  result.push({ date: sat, reason: "Primeiro fim de semana após dia 5" });
  result.push({ date: sun, reason: "Primeiro fim de semana após dia 5" });
  return result;
}

// --- UNIFIED AVAILABILITY LOGIC ---

export function calculateDateStatus(params: {
  date: Date;
  myUserId: string | null;
  allFolgas: { user_id: string; data: string }[];
  allProfiles: { id: string; folga_fixa_semana: number | null }[];
  manualBlocked: Map<string, { reason: string; liberada: boolean }>;
  dayLimits: Map<string, number>;
  birthdayByDate: Map<string, { userId: string }>;
  pendingRequests: { data: string }[];
  isAdmin: boolean;
  locked?: { unlockDateBR: string } | null;
}): DateStatus {
  const { date, myUserId, allFolgas, allProfiles, manualBlocked, dayLimits, birthdayByDate, pendingRequests, isAdmin, locked } = params;
  const iso = ymd(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Passado
  if (date < today) {
    return { status: "past", reason: "Data passada" };
  }

  const type = dayType(date);
  const isWknd = !!type;

  // 2. Minha Folga Mensal (Prioridade Visual)
  const isMine = myUserId && allFolgas.some(f => f.user_id === myUserId && f.data === iso);
  if (!isAdmin && isMine) {
    return { status: "mine", label: "Sua folga", reason: "Sua folga mensal registrada" };
  }

  // 3. Minha Folga Fixa
  const myProfile = allProfiles.find(p => p.id === myUserId);
  const isMyFixed = !isAdmin && myProfile?.folga_fixa_semana === date.getDay();
  if (!isAdmin && isMyFixed) {
    return { status: "fixed", label: "Semanal", reason: "Sua folga semanal fixa" };
  }

  // 4. Minha Solicitação Pendente
  const hasMyPending = !isAdmin && pendingRequests.some(r => r.data === iso);
  if (!isAdmin && hasMyPending) {
    return { status: "pending", label: "Sua solicitação", reason: "Aguardando aprovação" };
  }

  // 5. Bloqueio Administrativo (Manual ou Automático via Regra)
  const manual = manualBlocked.get(iso);
  if (manual && !manual.liberada) {
    return { status: "blocked", reason: manual.reason };
  }

  // 6. Bloqueio por Regra de Data (Primeiro FDS após dia 5)
  const autoBlocks = autoBlockedDatesForMonth(date.getFullYear(), date.getMonth());
  const autoReason = autoBlocks.find(b => b.date === iso)?.reason;
  if (autoReason && (!manual || !manual.liberada)) {
    return { status: "blocked", reason: autoReason };
  }

  // 7. Bloqueio por Mês Trancado (Apenas FDS)
  if (!isAdmin && locked && isWknd) {
    return { status: "blocked", reason: `Folgas ainda não liberadas (Abre em ${locked.unlockDateBR})` };
  }

  // 8. Prioridade de Aniversário de Terceiros
  const birthday = birthdayByDate.get(iso);
  if (!isAdmin && isWknd && birthday && birthday.userId !== myUserId) {
    return { status: "birthday", label: "Indisponível", reason: "Reservado para aniversariante" };
  }

  // 9. Cálculo de Ocupação Real (Mensais + Fixas de Terceiros)
  if (isWknd) {
    const limit = dayLimits.get(iso) ?? 1;
    
    // Contar folgas mensais de toda a equipe
    const monthlyCount = allFolgas.filter(f => f.data === iso).length;
    
    // Contar folgas fixas de toda a equipe
    const fixedCount = allProfiles.filter(p => p.folga_fixa_semana === date.getDay()).length;
    
    const totalOccupied = monthlyCount + fixedCount;

    if (totalOccupied >= limit) {
      return { status: "taken", label: "Indisponível", reason: "Limite de folgas atingido" };
    }
  }

  // 10. Disponível ou Dia de Semana Comum
  return { 
    status: isWknd ? "available" : "weekday",
    reason: isWknd ? "Disponível para seleção" : undefined
  };
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];