import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { toast } from "sonner";

export interface Pendencia {
  id: string;
  tipo: "excecao" | "contracheque" | "adiantamento" | "folha_ponto" | "negociacao";
  titulo: string;
  descricao: string;
  data_vencimento: string;
  dias_atraso: number;
  rota_resolver: string;
  unidade_id?: string | null;
  colaborador_id?: string | null;
  identificador_unico: string;
}

interface PendenciaContextType {
  pendencias: Pendencia[];
  loading: boolean;
  adiarPendencia: (identificadorUnico: string, dias: number) => Promise<void>;
  removerAdiamento: (identificadorUnico: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const PendenciaContext = createContext<PendenciaContextType | undefined>(undefined);

export function PendenciasProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarPendencias = useCallback(async () => {
    if (!user) {
      setPendencias([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Buscar pendências adiadas
      const { data: adiados, error: adiadosError } = await supabase
        .from("pendencias_adiadas")
        .select("tipo_pendencia, identificador, data_reexibicao")
        .eq("usuario_id", user.id)
        .gte("data_reexibicao", new Date().toISOString().split("T")[0]);

      if (adiadosError) throw adiadosError;

      const chaveAdiados = new Set();
      adiados?.forEach(a => {
        chaveAdiados.add(`${a.tipo_pendencia}-${a.identificador}`);
      });

      const pendenciasList: Pendencia[] = [];
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      // 1. Solicitações de exceção pendentes
      try {
        const { data: excecoes, error: excecoesError } = await supabase
          .from("solicitacoes_especiais")
          .select(`
            id,
            user_id,
            data,
            motivo,
            status,
            created_at,
            profiles!solicitacoes_especiais_user_id_fkey(nome)
          `)
          .eq("status", "pendente");

        if (excecoesError) throw excecoesError;

        if (excecoes && excecoes.length > 0) {
          for (const ex of excecoes) {
            const chave = `excecao-${ex.id}`;
            if (chaveAdiados.has(chave)) continue;

            const dataSolicitacao = ex.data || ex.created_at?.split("T")[0] || new Date().toISOString().split("T")[0];
            const dataVencimento = new Date(dataSolicitacao + "T00:00:00");
            const diffDias = Math.ceil((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));
            const diasAtraso = diffDias > 0 ? diffDias : 0;

            const colaboradorNome = (ex as any).profiles?.nome || "Colaborador";

            pendenciasList.push({
              id: `excecao-${ex.id}`,
              tipo: "excecao",
              titulo: "Solicitação de exceção pendente",
              descricao: `${colaboradorNome} - ${ex.motivo || "Sem motivo"} (${new Date(dataSolicitacao).toLocaleDateString("pt-BR")})`,
              data_vencimento: dataSolicitacao,
              dias_atraso: diasAtraso,
              rota_resolver: "/admin/solicitacoes",
              identificador_unico: chave,
            });
          }
        }
      } catch (error) {
        console.warn("Erro ao buscar solicitações de exceção:", error);
      }

      // 2. Documentos (contracheque, adiantamento, folha de ponto)
      const mesVigente = hoje.getMonth() + 1;
      const anoVigente = hoje.getFullYear();
      const diaHoje = hoje.getDate();

      const { data: unidades, error: unidError } = await supabase
        .from("unidades")
        .select("id, nome, possui_relogio_ponto, tem_adiantamento, dia_adiantamento")
        .eq("ativo", true);

      if (unidError) throw unidError;

      const mesAnterior = mesVigente === 1 ? 12 : mesVigente - 1;
      const anoAnterior = mesVigente === 1 ? anoVigente - 1 : anoVigente;

      const verificarDocumento = async (tipo: string, unidadeId: string, mes: number, ano: number, dataVencimento: Date) => {
        const chave = `${tipo}-${unidadeId}-${mes}-${ano}`;
        if (chaveAdiados.has(chave)) return null;

        const { count, error } = await supabase
          .from("documentos")
          .select("*", { count: "exact", head: true })
          .eq("tipo", tipo)
          .eq("unidade_id", unidadeId)
          .eq("mes", mes)
          .eq("ano", ano);

        if (error) {
          console.warn(`Erro ao verificar ${tipo} para unidade ${unidadeId}:`, error);
          return null;
        }

        if (count === 0) {
          const diffDias = Math.ceil((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));
          const diasAtraso = diffDias > 0 ? diffDias : 0;
          return { chave, diasAtraso };
        }
        return null;
      };

      for (const unidade of unidades) {
        // Contracheque
        if (diaHoje >= 10) {
          const dataVencimento = new Date(anoAnterior, mesAnterior - 1, 10);
          const resultado = await verificarDocumento("contracheque", unidade.id, mesAnterior, anoAnterior, dataVencimento);
          if (resultado) {
            pendenciasList.push({
              id: resultado.chave,
              tipo: "contracheque",
              titulo: "Contracheque não importado",
              descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
              data_vencimento: dataVencimento.toISOString().split("T")[0],
              dias_atraso: resultado.diasAtraso,
              rota_resolver: "/admin/documentos/contracheque",
              unidade_id: unidade.id,
              identificador_unico: resultado.chave,
            });
          }
        }

        // Adiantamento
        if (unidade.tem_adiantamento && unidade.dia_adiantamento) {
          const diaAdiantamento = unidade.dia_adiantamento;
          const diaLimite = diaAdiantamento + 5;
          if (diaHoje >= diaLimite) {
            const dataVencimento = new Date(anoVigente, mesVigente - 1, diaLimite);
            const resultado = await verificarDocumento("adiantamento", unidade.id, mesVigente, anoVigente, dataVencimento);
            if (resultado) {
              pendenciasList.push({
                id: resultado.chave,
                tipo: "adiantamento",
                titulo: "Adiantamento não importado",
                descricao: `${unidade.nome} - ${String(mesVigente).padStart(2, "0")}/${anoVigente}`,
                data_vencimento: dataVencimento.toISOString().split("T")[0],
                dias_atraso: resultado.diasAtraso,
                rota_resolver: "/admin/documentos/adiantamento",
                unidade_id: unidade.id,
                identificador_unico: resultado.chave,
              });
            }
          }
        }

        // Folha de ponto
        if (unidade.possui_relogio_ponto && diaHoje >= 10) {
          const dataVencimento = new Date(anoAnterior, mesAnterior - 1, 10);
          const resultado = await verificarDocumento("ponto", unidade.id, mesAnterior, anoAnterior, dataVencimento);
          if (resultado) {
            pendenciasList.push({
              id: resultado.chave,
              tipo: "folha_ponto",
              titulo: "Folha de ponto não importada",
              descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
              data_vencimento: dataVencimento.toISOString().split("T")[0],
              dias_atraso: resultado.diasAtraso,
              rota_resolver: "/admin/documentos/ponto",
              unidade_id: unidade.id,
              identificador_unico: resultado.chave,
            });
          }
        }
      }

      // 3. Negociações coletivas
      try {
        for (const unidade of unidades) {
          const { data: negociacao, error: negError } = await supabase
            .from("negociacoes")
            .select("ano, mes, created_at")
            .eq("unidade_id", unidade.id)
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .limit(1);

          if (negError) {
            console.warn(`Erro ao buscar negociação para unidade ${unidade.id}:`, negError);
            continue;
          }

          let dataVencimento: Date;
          let diffDias: number;
          let chave: string;

          if (negociacao && negociacao.length > 0) {
            const ultima = negociacao[0];
            // Vencimento: último dia do mês da data base + 1 ano
            dataVencimento = new Date(ultima.ano + 1, ultima.mes - 1, 0);
            const dataInicioAtraso = new Date(dataVencimento);
            dataInicioAtraso.setDate(dataInicioAtraso.getDate() + 1);
            diffDias = Math.ceil((hoje.getTime() - dataInicioAtraso.getTime()) / (1000 * 60 * 60 * 24));
            chave = `negociacao-${unidade.id}-${ultima.ano}-${ultima.mes}`;
          } else {
            dataVencimento = new Date(hoje);
            diffDias = 0;
            chave = `negociacao-${unidade.id}-sem`;
          }

          if (diffDias > 0 && !chaveAdiados.has(chave)) {
            const descricao = negociacao && negociacao.length > 0
              ? `${unidade.nome} - Última: ${String(negociacao[0].mes).padStart(2, "0")}/${negociacao[0].ano}`
              : `${unidade.nome} - Nenhuma negociação cadastrada`;
            pendenciasList.push({
              id: chave,
              tipo: "negociacao",
              titulo: "Negociação coletiva pendente",
              descricao: descricao,
              data_vencimento: dataVencimento.toISOString().split("T")[0],
              dias_atraso: diffDias,
              rota_resolver: "/admin/documentos/act-cct",
              unidade_id: unidade.id,
              identificador_unico: chave,
            });
          }
        }
      } catch (error) {
        console.warn("Erro ao buscar negociações por unidade:", error);
      }

      pendenciasList.sort((a, b) => b.dias_atraso - a.dias_atraso);

      setPendencias(pendenciasList);
    } catch (error) {
      console.error("Erro ao carregar pendências:", error);
      toast.error("Erro ao carregar pendências");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    carregarPendencias();
  }, [carregarPendencias]);

  const adiarPendencia = async (identificadorUnico: string, dias: number) => {
    if (!user) return;
    try {
      const [tipo] = identificadorUnico.split('-');
      const dataReexibicao = new Date();
      dataReexibicao.setDate(dataReexibicao.getDate() + dias);
      const dataStr = dataReexibicao.toISOString().split("T")[0];

      const { error } = await supabase
        .from("pendencias_adiadas")
        .insert({
          usuario_id: user.id,
          tipo_pendencia: tipo,
          identificador: identificadorUnico,
          data_reexibicao: dataStr,
        });

      if (error) throw error;
      await carregarPendencias();
      toast.success(`Pendência adiada por ${dias} dia(s)`);
    } catch (error) {
      console.error("Erro ao adiar pendência:", error);
      toast.error("Erro ao adiar pendência");
    }
  };

  const removerAdiamento = async (identificadorUnico: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("pendencias_adiadas")
        .delete()
        .eq("usuario_id", user.id)
        .eq("identificador", identificadorUnico);

      if (error) throw error;
      await carregarPendencias();
    } catch (error) {
      console.error("Erro ao remover adiamento:", error);
    }
  };

  const refresh = async () => {
    await carregarPendencias();
  };

  return (
    <PendenciaContext.Provider value={{ pendencias, loading, adiarPendencia, removerAdiamento, refresh }}>
      {children}
    </PendenciaContext.Provider>
  );
}

export function usePendencias() {
  const context = useContext(PendenciaContext);
  if (context === undefined) {
    throw new Error("usePendencias must be used within a PendenciasProvider");
  }
  return context;
}