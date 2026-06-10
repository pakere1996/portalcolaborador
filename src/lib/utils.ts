import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Retorna apenas os dígitos de uma string.
 * @param value A string de entrada.
 * @returns A string contendo apenas dígitos.
 */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Formata um número de telefone (fixo ou celular) com DDD.
 * Suporta 10 dígitos (fixo) ou 11 dígitos (celular).
 * @param value O número de telefone (apenas dígitos).
 * @returns O número formatado ou a string original se o formato for inválido.
 */
export function formatPhone(value: string): string {
  const digits = onlyDigits(value);
  const length = digits.length;

  if (length <= 2) {
    // Apenas DDD
    return length > 0 ? `(${digits}` : digits;
  }

  if (length <= 6) {
    // (XX) XXXX
    return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
  }

  if (length === 10) {
    // Fixo: (XX) XXXX-XXXX
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6, 10)}`;
  }

  if (length === 11) {
    // Celular: (XX) XXXXX-XXXX
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
  }

  // Se for maior que 11, ou um formato não reconhecido, retorna o máximo que puder formatar
  if (length > 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
  }

  // Para 7, 8 ou 9 dígitos (sem DDD ou incompleto), retorna o que for possível
  if (length > 6) {
    const part1 = digits.substring(2, length - 4);
    const part2 = digits.substring(length - 4);
    return `(${digits.substring(0, 2)}) ${part1}-${part2}`;
  }

  return digits;
}