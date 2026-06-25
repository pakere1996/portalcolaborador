import { describe, it, expect } from 'vitest';

// Suponha que exista uma função "calcularDiasAtraso" no arquivo folga-rules.ts
// Se não existir, você pode criar uma função simples no próprio teste para demonstrar.
// Vamos importar a função real (se existir) ou criar uma versão de teste.
// Como não sei exatamente como está seu código, vou criar uma função de exemplo aqui mesmo.
// Depois você pode substituir pela importação real.

// Exemplo de função (coloque isso no seu arquivo folga-rules.ts se quiser testar)
function calcularDiasAtraso(dataVencimento: string): number {
  const hoje = new Date();
  const vencimento = new Date(dataVencimento);
  const diff = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  return diff; // positivo = atrasado, negativo = futuro
}

describe('Cálculo de dias de atraso', () => {
  it('deve retornar 0 se a data de vencimento for hoje', () => {
    const hoje = new Date().toISOString().split('T')[0]; // '2026-06-25'
    const resultado = calcularDiasAtraso(hoje);
    expect(resultado).toBe(0);
  });

  it('deve retornar número positivo se a data já passou (atraso)', () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dataStr = ontem.toISOString().split('T')[0];
    const resultado = calcularDiasAtraso(dataStr);
    expect(resultado).toBeGreaterThan(0);
  });

  it('deve retornar número negativo se a data for futura (sinalização prévia)', () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 5);
    const dataStr = amanha.toISOString().split('T')[0];
    const resultado = calcularDiasAtraso(dataStr);
    expect(resultado).toBeLessThan(0);
  });
});