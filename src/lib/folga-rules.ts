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

/**
 * Retorna datas que seriam bloqueadas automaticamente por regras fixas.
 * Atualmente as regras são gerenciadas via banco de dados (bloqueio_regras),
 * mas mantemos a função para compatibilidade com os componentes de UI.
 */
export function autoBlockedDatesForMonth(year: number, month0: number): { date: string; reason: string }[] {
  return [];
}

// --- UNIFIED AVAILABILITY LOGIC ---

export function calculateDateStatus(params: {
  date: Date;
  myUserId: string | null;
  allFolgas?: { user_id: string; data: string; tipo?: string }[];
  allProfiles?: { id: string; folga_fixa_semana: number | null }[];
  manualBlocked?: Map<string, { reason: string; liberada: boolean }>;
  dayLimits?: Map<string, number>;
  birthdayByDate?: Map<string, { userId: string }>;
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
    locked 
  } = params;
  
  const iso = ymd(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Passado
  if (date < today) {
    return { status: "past", reason: "Data passada" };
  }

  const type = dayType(date);
  const isWknd = !!type;

  // 2. Bloqueio Administrativo
  const manual = manualBlocked.get(iso);
  if (manual && !manual.liberada) {
    return { status: "blocked", reason: manual.reason };
  }

  // 3. Minha Folga (Mensal ou Troca)
  const myFolga = myUserId && allFolgas.find(f => f.user_id === myUserId && f.data === iso);
  if (!isAdmin && myFolga) {
    const label = myFolga.tipo === 'troca' ? "Troca Aprovada" : "Sua folga";
    return { status: myFolga.tipo === 'troca' ? "swapped" : "mine", label, reason: label };
  }

  // 4. Minha Folga Fixa (Verificar se não foi cancelada temporariamente)
  const myProfile = allProfiles.find(p => p.id === myUserId);
  const isCanceled = myUserId && canceledFolgas.some(c => c.user_id === myUserId && c.data === iso);
  const isMyFixed = !isAdmin && myProfile?.folga_fixa_semana === date.getDay() && !isCanceled;
  
  if (!isAdmin && isMyFixed) {
    return { status: "fixed", label: "Semanal", reason: "Sua folga semanal fixa" };
  }

  // 5. Minha Solicitação Pendente (Troca ou Especial)
  const hasMyPending = !isAdmin && pendingRequests.some(r => r.data === iso && r.user_id === myUserId);
  if (!isAdmin && hasMyPending) {
    return { status: "pending", label: "Pendente", reason: "Aguardando aprovação" };
  }

  // 6. Bloqueio por Mês Trancado (Apenas FDS)
  if (!isAdmin && locked && isWknd) {
    return { status: "blocked", reason: `Folgas ainda não liberadas (Abre em ${locked.unlockDateBR})` };
  }

  // 7. Prioridade de Aniversário
  const birthday = birthdayByDate.get(iso);
  if (!isAdmin && isWknd && birthday && birthday.userId !== myUserId) {
    return { status: "birthday", label: "Indisponível", reason: "Reservado para aniversariante" };
  }

  // 8. Cálculo de Ocupação Real
  const limit = dayLimits.get(iso) ?? 1;
  const monthlyCount = allFolgas.filter(f => f.data === iso).length;
  const fixedCount = allProfiles.filter(p => {
    const hasFixed = p.folga_fixa_semana === date.getDay();
    const canceled = canceledFolgas.some(c => c.user_id === p.id && c.data === iso);
    return hasFixed && !canceled;
  }).length;
  
  const totalOccupied = monthlyCount + fixedCount;

  if (totalOccupied >= limit) {
    return { status: "taken", label: "Lotado", reason: "Limite de folgas atingido" };
  }

  // 9. Disponível ou Dia de Semana Comum
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