import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { toast } from "sonner";

export interface Pendencia {
  id: string;
  tipo: "troca" | "contracheque" | "adiantamento" | "folha_ponto" | "negociacao";
  titulo: string;
  descricao: string;
  data_vencimento: string; // data de vencimento da pendência (YYYY-MM-DD)
  data_referencia?: string; // data de referência original (opcional)
  rota_resolver: string;
  unidade_id?: string | null;
  colaborador_id?: string | null;
  identificador_unico: string;
  dias_atraso?: number; // calculado dinamicamente
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
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeStr = hoje.toISOString().split("T")[0];

      // 1. Buscar pendências adiadas do usuário
      const { data: adiados, error: adiadosError } = await supabase
        .from("pendencias_adiadas")
        .select("tipo_pendencia, identificador, data_reexibicao")
        .eq("usuario_id", user.id)
        .gte("data_reexibicao", hojeStr);

      if (adiadosError) throw adiadosError;

      const chaveAdiados = new Set();
      adiados?.forEach(a => {
        chaveAdiados.add(`${a.tipo_pendencia}-${a.identificador}`);
      });

      const pendenciasList: Pendencia[] = [];

      // 2. Trocas pendentes
      try {
        const { data: trocas, error: trocasError } = await supabase
          .from("trocas_folga")
          .select("*")
          .eq("status", "pendente");

        if (trocasError) throw trocasError;

        if (trocas && trocas.length > 0) {
          const userIds = new Set<string>();
          trocas.forEach(t => {
            if (t.solicitante_id) userIds.add(t.solicitante_id);
            if (t.destinatario_id) userIds.add(t.destinatario_id);
          });

          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nome")
            .in("id", Array.from(userIds));

          if (profilesError) throw profilesError;

          const profileMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

          trocas.forEach(t => {
            const chave = `troca-${t.id}`;
            if (chaveAdiados.has(chave)) return;

            const solicitanteNome = profileMap.get(t.solicitante_id) || "Solicitante";
            const destinatarioNome = profileMap.get(t.destinatario_id) || "Destinatário";
            // Data de vencimento: a data da troca (data_destinatario) ou a data de criação
            const dataVencimento = t.data_destinatario || t.created_at || hojeStr;

            pendenciasList.push({
              id: `troca-${t.id}`,
              tipo: "troca",
              titulo: "Troca de folga pendente",
              descricao: `${solicitanteNome} → ${destinatarioNome} (${new Date(dataVencimento).toLocaleDateString("pt-BR")})`,
              data_vencimento: dataVencimento,
              data_referencia: dataVencimento,
              rota_resolver: "/admin/solicitacoes",
              identificador_unico: chave,
            });
          });
        }
      } catch (error) {
        console.warn("Erro ao buscar trocas:", error);
      }

      // 3. Documentos (contracheque, adiantamento, folha de ponto)
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

      for (const unidade of unidades) {
        // Contracheque: vence dia 10 do mês seguinte
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
              // Data de vencimento: 10 do mês vigente (mês seguinte)
              const vencimento = new Date(anoVigente, mesVigente - 1, 10);
              const vencimentoStr = vencimento.toISOString().split("T")[0];
              pendenciasList.push({
                id: chave,
                tipo: "contracheque",
                titulo: "Contracheque não importado",
                descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
                data_vencimento: vencimentoStr,
                data_referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`,
                rota_resolver: "/admin/documentos/contracheque",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }

        // Adiantamento: vence no dia (dia_adiantamento + 5) do mês vigente
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
                // Data de vencimento: diaLimite do mês vigente
                const vencimento = new Date(anoVigente, mesVigente - 1, diaLimite);
                const vencimentoStr = vencimento.toISOString().split("T")[0];
                pendenciasList.push({
                  id: chave,
                  tipo: "adiantamento",
                  titulo: "Adiantamento não importado",
                  descricao: `${unidade.nome} - ${String(mesVigente).padStart(2, "0")}/${anoVigente}`,
                  data_vencimento: vencimentoStr,
                  data_referencia: `${anoVigente}-${String(mesVigente).padStart(2, "0")}-01`,
                  rota_resolver: "/admin/documentos/adiantamento",
                  unidade_id: unidade.id,
                  identificador_unico: chave,
                });
              }
            }
          }
        }

        // Folha de ponto: vence dia 10 do mês seguinte (apenas se unidade tem relógio)
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
              const vencimento = new Date(anoVigente, mesVigente - 1, 10);
              const vencimentoStr = vencimento.toISOString().split("T")[0];
              pendenciasList.push({
                id: chave,
                tipo: "folha_ponto",
                titulo: "Folha de ponto não importada",
                descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
                data_vencimento: vencimentoStr,
                data_referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`,
                rota_resolver: "/admin/documentos/ponto",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }
      }

      // 4. Negociações coletivas: pendência para cada unidade que não tiver acordo atualizado
      // Verificar para cada unidade a última negociação
      for (const unidade of unidades) {
        const { data: negociacoes, error: negError } = await supabase
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

        if (negociacoes && negociacoes.length > 0) {
          const ultima = negociacoes[0];
          const dataBase = new Date(ultima.ano, ultima.mes - 1, 1);
          const diffDias = Math.floor((hoje.getTime() - dataBase.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDias >= 365) {
            const chave = `negociacao-${unidade.id}-${ultima.ano}-${ultima.mes}`;
            if (!chaveAdiados.has(chave)) {
              // Data de vencimento: data base + 365 dias
              const vencimento = new Date(dataBase);
              vencimento.setFullYear(vencimento.getFullYear() + 1);
              const vencimentoStr = vencimento.toISOString().split("T")[0];
              pendenciasList.push({
                id: chave,
                tipo: "negociacao",
                titulo: "Negociação coletiva pendente",
                descricao: `${unidade.nome} - Última: ${String(ultima.mes).padStart(2, "0")}/${ultima.ano}`,
                data_vencimento: vencimentoStr,
                data_referencia: `${ultima.ano}-${String(ultima.mes).padStart(2, "0")}-01`,
                rota_resolver: "/admin/documentos/act-cct",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        } else {
          // Unidade sem nenhuma negociação: considerar pendente desde a data de criação da unidade? Vamos usar hoje como referência.
          const chave = `negociacao-${unidade.id}-nenhuma`;
          if (!chaveAdiados.has(chave)) {
            // Data de vencimento: hoje (considera pendente desde hoje)
            pendenciasList.push({
              id: chave,
              tipo: "negociacao",
              titulo: "Negociação coletiva pendente",
              descricao: `${unidade.nome} - Nenhuma negociação cadastrada`,
              data_vencimento: hojeStr,
              data_referencia: hojeStr,
              rota_resolver: "/admin/documentos/act-cct",
              unidade_id: unidade.id,
              identificador_unico: chave,
            });
          }
        }
      }

      // Calcular dias de atraso para cada pendência
      const agora = new Date();
      agora.setHours(0, 0, 0, 0);

      pendenciasList.forEach(p => {
        const venc = new Date(p.data_vencimento + "T00:00:00");
        const diffTime = agora.getTime() - venc.getTime();
        p.dias_atraso = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      });

      // Ordenar por maior atraso primeiro
      pendenciasList.sort((a, b) => (b.dias_atraso || 0) - (a.dias_atraso || 0));

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