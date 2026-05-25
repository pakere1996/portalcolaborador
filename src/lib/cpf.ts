// CPF utilities: strip / format / synthesize email
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

export function formatCPF(s: string): string {
  const d = onlyDigits(s).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCPFLength(s: string): boolean {
  return onlyDigits(s).length === 11;
}

export function cpfToEmail(cpf: string): string {
  return `${onlyDigits(cpf)}@pizzaria.local`;
}
