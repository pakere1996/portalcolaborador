import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { toast } from "sonner";

export interface Pendencia {
  id: string;
  tipo: "solicitacao" | "contracheque" | "adiantamento" | "folha_ponto" | "negociacao";
  titulo: string;
  descricao: string;
  data_referencia: string; // data de criação ou vencimento
  data_vencimento?: string; // data de vencimento (quando aplicável)
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
      // 1. Buscar pendências adiadas do usuário
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

      // 2. Buscar solicitações de exceção pendentes (solicitacoes_especiais)
      try {
        const { data: solicitacoes, error: solicitacoesError } = await supabase
          .from("solicitacoes_especiais")
          .select(`
            id,
            user_id,
            data,
            motivo,
            status,
            created_at,
            profiles!solicitacoes_especiais_user_id_fkey (nome)
          `)
          .eq("status", "pendente")
          .order("created_at", { ascending: true });

        if (solicitacoesError) throw solicitacoesError;

        solicitacoes?.forEach(s => {
          const chave = `solicitacao-${s.id}`;
          if (chaveAdiados.has(chave)) return;

          const colaboradorNome = s.profiles?.nome || "Colaborador";
          const dataRef = s.created_at || new Date().toISOString();
          const dataVencimento = new Date(dataRef);
          dataVencimento.setDate(dataVencimento.getDate() + 3); // 3 dias para resposta

          pendenciasList.push({
            id: `solicitacao-${s.id}`,
            tipo: "solicitacao",
            titulo: "Solicitação de exceção pendente",
            descricao: `${colaboradorNome} - ${new Date(s.data).toLocaleDateString("pt-BR")}: ${s.motivo || "Sem motivo"}`,
            data_referencia: dataRef,
            data_vencimento: dataVencimento.toISOString().split("T")[0],
            rota_resolver: "/admin/solicitacoes",
            identificador_unico: chave,
          });
        });
      } catch (error) {
        console.warn("Erro ao buscar solicitações de exceção:", error);
      }

      // 3. Documentos (contracheque, adiantamento, folha de ponto)
      const hoje = new Date();
      const mesVigente = hoje.getMonth() + 1;
      const anoVigente = hoje.getFullYear();
      const diaHoje = hoje.getDate();

      // Buscar unidades ativas
      const { data: unidades, error: unidError } = await supabase
        .from("unidades")
        .select("id, nome, possui_relogio_ponto, tem_adiantamento, dia_adiantamento")
        .eq("ativo", true);

      if (unidError) throw unidError;

      const mesAnterior = mesVigente === 1 ? 12 : mesVigente - 1;
      const anoAnterior = mesVigente === 1 ? anoVigente - 1 : anoVigente;

      for (const unidade of unidades) {
        // Contracheque (a partir do dia 10, referente ao mês anterior)
        // Vencimento: dia 10 de cada mês
        if (diaHoje >= 10) {
          const chave = `contracheque-${unidade.id}-${mesAnterior}-${anoAnterior}`;
          if (!chaveAdiados.has(chave)) {
            const { count, error: countError } = await supabase
              .from("documentos")
              .select("*", { count: "exact", head: true })
              .eq("tipo", "contracheque")
              .eq("unidade_id", unidade.id)
              .eq("mes", mesAnterior)
              .eq("ano", anoAnterior);

            if (!countError && count === 0) {
              const dataVencimento = new Date(anoAnterior, mesAnterior - 1, 10);
              pendenciasList.push({
                id: chave,
                tipo: "contracheque",
                titulo: "Contracheque não importado",
                descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
                data_referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`,
                data_vencimento: dataVencimento.toISOString().split("T")[0],
                rota_resolver: "/admin/documentos/contracheque",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }

        // Adiantamento (a partir do dia D+5, referente ao mês vigente)
        // Vencimento: dia do adiantamento + 5 dias
        if (unidade.tem_adiantamento && unidade.dia_adiantamento) {
          const diaAdiantamento = unidade.dia_adiantamento;
          const diaLimite = diaAdiantamento + 5;
          if (diaHoje >= diaLimite) {
            const chave = `adiantamento-${unidade.id}-${mesVigente}-${anoVigente}`;
            if (!chaveAdiados.has(chave)) {
              const { count, error: countError } = await supabase
                .from("documentos")
                .select("*", { count: "exact", head: true })
                .eq("tipo", "adiantamento")
                .eq("unidade_id", unidade.id)
                .eq("mes", mesVigente)
                .eq("ano", anoVigente);

              if (!countError && count === 0) {
                const dataVencimento = new Date(anoVigente, mesVigente - 1, diaLimite);
                pendenciasList.push({
                  id: chave,
                  tipo: "adiantamento",
                  titulo: "Adiantamento não importado",
                  descricao: `${unidade.nome} - ${String(mesVigente).padStart(2, "0")}/${anoVigente}`,
                  data_referencia: `${anoVigente}-${String(mesVigente).padStart(2, "0")}-01`,
                  data_vencimento: dataVencimento.toISOString().split("T")[0],
                  rota_resolver: "/admin/documentos/adiantamento",
                  unidade_id: unidade.id,
                  identificador_unico: chave,
                });
              }
            }
          }
        }

        // Folha de ponto (a partir do dia 10, referente ao mês anterior, apenas se unidade tem relógio)
        // Vencimento: dia 10 de cada mês
        if (unidade.possui_relogio_ponto && diaHoje >= 10) {
          const chave = `folha_ponto-${unidade.id}-${mesAnterior}-${anoAnterior}`;
          if (!chaveAdiados.has(chave)) {
            const { count, error: countError } = await supabase
              .from("documentos")
              .select("*", { count: "exact", head: true })
              .eq("tipo", "ponto")
              .eq("unidade_id", unidade.id)
              .eq("mes", mesAnterior)
              .eq("ano", anoAnterior);

            if (!countError && count === 0) {
              const dataVencimento = new Date(anoAnterior, mesAnterior - 1, 10);
              pendenciasList.push({
                id: chave,
                tipo: "folha_ponto",
                titulo: "Folha de ponto não importada",
                descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
                data_referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`,
                data_vencimento: dataVencimento.toISOString().split("T")[0],
                rota_resolver: "/admin/documentos/ponto",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }
      }

      // 4. Negociações coletivas (por unidade)
      try {
        // Buscar todas as unidades ativas
        const { data: unidadesNeg, error: unidNegError } = await supabase
          .from("unidades")
          .select("id, nome")
          .eq("ativo", true);

        if (unidNegError) throw unidNegError;

        for (const unidade of unidadesNeg) {
          // Buscar a última negociação para esta unidade
          const { data: negociacao, error: negError } = await supabase
            .from("negociacoes")
            .select("ano, mes, created_at")
            .eq("unidade_id", unidade.id)
            .order("ano", { ascending: false })
            .order("mes", { ascending: false })
            .limit(1);

          if (negError) throw negError;

          let dataBase: Date | null = null;
          if (negociacao && negociacao.length > 0) {
            const ultima = negociacao[0];
            dataBase = new Date(ultima.ano, ultima.mes - 1, 1);
          } else {
            // Se não houver negociação, consideramos que a data base é 01/01/2020 (ou uma data padrão antiga)
            dataBase = new Date(2020, 0, 1);
          }

          const diffDias = Math.floor((hoje.getTime() - dataBase.getTime()) / (1000 * 60 * 60 * 24));
          // Vencimento: a cada 365 dias (anual)
          if (diffDias >= 365) {
            const chave = `negociacao-${unidade.id}`;
            if (!chaveAdiados.has(chave)) {
              const dataVencimento = new Date(dataBase);
              dataVencimento.setFullYear(dataVencimento.getFullYear() + 1);

              pendenciasList.push({
                id: chave,
                tipo: "negociacao",
                titulo: "Negociação coletiva pendente",
                descricao: `${unidade.nome} - Última: ${dataBase ? String(dataBase.getMonth() + 1).padStart(2, "0") + "/" + dataBase.getFullYear() : "N/A"}`,
                data_referencia: dataBase ? dataBase.toISOString().split("T")[0] : hoje.toISOString().split("T")[0],
                data_vencimento: dataVencimento.toISOString().split("T")[0],
                rota_resolver: "/admin/documentos/act-cct",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }
      } catch (error) {
        console.warn("Erro ao buscar negociações:", error);
      }

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
      const [tipo, ...resto] = identificadorUnico.split('-');
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