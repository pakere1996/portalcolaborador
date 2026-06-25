import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PendenciasWidget from '../PendenciasWidget';
import { PendênciasProvider } from '../../lib/pendencias-context';

// Mock do react-router (porque o widget pode ter navegação)
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock do sonner (toast)
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe('PendenciasWidget', () => {
  it('deve exibir "Nenhuma pendência" quando a lista estiver vazia', async () => {
    // Forçamos o contexto a retornar lista vazia
    vi.mock('../../lib/pendencias-context', () => ({
      usePendências: () => ({
        pendências: [],
        loading: false,
        adiarPendência: vi.fn(),
        resolverPendência: vi.fn(),
      }),
    }));

    render(<PendenciasWidget />);
    expect(screen.getByText(/Nenhuma pendência/i)).toBeInTheDocument();
  });

  it('deve exibir uma pendência com botões de ação', async () => {
    const mockAdiar = vi.fn();
    const mockResolver = vi.fn();

    vi.mock('../../lib/pendencias-context', () => ({
      usePendências: () => ({
        pendências: [
          {
            id: '1',
            titulo: 'Contracheque atrasado',
            diasAtraso: 3,
            tipo: 'documento',
            acao: 'Resolver',
          },
        ],
        loading: false,
        adiarPendência: mockAdiar,
        resolverPendência: mockResolver,
      }),
    }));

    render(<PendenciasWidget />);

    // Verifica se o título aparece
    expect(screen.getByText('Contracheque atrasado')).toBeInTheDocument();

    // Verifica se os botões existem
    const botaoResolver = screen.getByRole('button', { name: /Resolvido/i });
    const botaoAdiar = screen.getByRole('button', { name: /Adiar/i });

    expect(botaoResolver).toBeInTheDocument();
    expect(botaoAdiar).toBeInTheDocument();

    // Simula clique em "Adiar"
    const user = userEvent.setup();
    await user.click(botaoAdiar);

    // Verifica se a função foi chamada
    expect(mockAdiar).toHaveBeenCalledWith('1', expect.any(Number));
  });
});