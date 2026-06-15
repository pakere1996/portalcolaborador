import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Removes formatting from CNPJ (e.g., 00.000.000/0000-00 -> 00000000000000)
 */
export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, "");
}

/**
 * Formats CNPJ (e.g., 00000000000000 -> 00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cleanCNPJ(cnpj);
  if (cleaned.length !== 14) return cnpj;

  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Validates CNPJ format (XX.XXX.XXX/XXXX-XX)
 */
export function validateCNPJFormat(cnpj: string): boolean {
  const regex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
  return regex.test(cnpj);
}

/**
 * Masks CNPJ for display (e.g., 00.000.000/0000-00 -> XX.XXX.XXX/XXXX-XX)
 */
export function maskCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "N/A";
  const cleaned = cleanCNPJ(cnpj);
  if (cleaned.length !== 14) return "CNPJ Inválido";
  
  return formatCNPJ(cleaned);
}

/**
 * Formats a phone number to (XX) XXXXX-XXXX format
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}