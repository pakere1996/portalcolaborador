import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PendênciasProvider, usePendências } from '../pendencias-context';
import { supabase } from '../supabase/client';

// Mock do Supabase para não chamar o banco de verdade
vi.mock('../supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn(),
  },
}));

// Componente simples que usa o contexto
const TestConsumer = () => {
  const { pendências, loading } = usePendências();
  if (loading) return <div>Carregando...</div>;
  return <div data-testid="count">Total: {pendências.length}</div>;
};

describe('PendênciasContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve carregar e exibir a lista de pendências', async () => {
    // Simula que o Supabase retornou duas pendências
    const mockPendencias = [
      { id: 1, tipo: 'documento', descricao: 'Contracheque em atraso' },
      { id: 2, tipo: 'negociacao', descricao: 'ACT vencendo' },
    ];

    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: mockPendencias, error: null }),
    }));

    render(
      <PendênciasProvider>
        <TestConsumer />
      </PendênciasProvider>
    );

    // Espera que apareça "Total: 2"
    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Total: 2');
    });
  });

  it('deve lidar com erro na busca e mostrar 0 pendências', async () => {
    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: null, error: new Error('Erro') }),
    }));

    render(
      <PendênciasProvider>
        <TestConsumer />
      </PendênciasProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('Total: 0');
    });
  });
});