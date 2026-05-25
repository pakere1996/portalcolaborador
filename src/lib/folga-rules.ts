// Business rules for folgas (pizzaria)

export type DateStatus =
  | { kind: "available" }
  | { kind: "blocked"; reason: string; canRequest: boolean }
  | { kind: "taken"; userId: string; userName?: string; isMine: boolean }
  | { kind: "past" }
  | { kind: "not-weekend" };

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

// Selection unlock day: month N+1 can be selected starting day 15 of month N
export function unlockDateForMonth(targetYear: number, targetMonth0: number): Date {
  // Returns the date in month BEFORE target when selection unlocks
  const d = new Date(targetYear, targetMonth0 - 1, 15);
  return d;
}

export function isMonthUnlocked(targetYear: number, targetMonth0: number, today: Date = new Date()): boolean {
  // Current month: always unlocked (already in play)
  // Past months: unlocked (read-only anyway)
  // Future month N+1: unlocked from day 15 of N
  const cur = new Date(today.getFullYear(), today.getMonth(), 1);
  const target = new Date(targetYear, targetMonth0, 1);
  if (target <= cur) return true;
  const unlock = unlockDateForMonth(targetYear, targetMonth0);
  return today >= unlock;
}

// Nth Sunday of month (n: 1-based)
function nthSundayOfMonth(year: number, month0: number, n: number): Date {
  const d = new Date(year, month0, 1);
  const offset = (7 - d.getDay()) % 7; // days until first Sunday
  return new Date(year, month0, 1 + offset + (n - 1) * 7);
}

// Special blocked dates for a given year
export function specialBlockedDates(year: number): { date: string; reason: string }[] {
  return [
    { date: ymd(nthSundayOfMonth(year, 4, 2)), reason: "Dia das Mães" },
    { date: ymd(nthSundayOfMonth(year, 7, 2)), reason: "Dia dos Pais" },
    { date: `${year}-06-12`, reason: "Dia dos Namorados" },
    { date: `${year}-10-12`, reason: "Dia das Crianças" },
    { date: `${year}-12-24`, reason: "Véspera de Natal" },
    { date: `${year}-12-31`, reason: "Véspera de Ano Novo" },
  ];
}

// First weekend (sat+sun) after day 5 of month
export function firstWeekendAfterDay5(year: number, month0: number): string[] {
  // Find Saturday on or after day 6
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

export function getMonthDays(year: number, month0: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month0 + 1, 0).getDate();
  for (let i = 1; i <= last; i++) days.push(new Date(year, month0, i));
  return days;
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
