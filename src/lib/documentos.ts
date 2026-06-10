export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}