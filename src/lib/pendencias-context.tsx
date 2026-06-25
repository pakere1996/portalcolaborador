import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { toast } from "sonner";

export interface Pendencia {
  id: string;
  tipo: "troca" | "contracheque" | "adiantamento" | "folha_ponto" | "negociacao";
  titulo: string;
  descricao: string;
  data_referencia: string;
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
      // 1. Buscar pendencias_adiadas do usuário para filtrar
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

      // 2. Buscar solicitações de troca pendentes
      const { data: trocas, error: trocasError } = await supabase
        .from("trocas_folga")
        .select(`
          id,
          data_destinatario,
          solicitante_id,
          destinatario_id,
          status,
          solicitante:profiles!solicitante_id(nome),
          destinatario:profiles!destinatario_id(nome)
        `)
        .eq("status", "pendente");

      if (trocasError) {
        console.warn("Erro ao buscar trocas:", trocasError);
        // Não interrompe o fluxo, apenas loga o erro
      } else {
        trocas?.forEach(t => {
          const chave = `troca-${t.id}`;
          if (chaveAdiados.has(chave)) return;

          const dataRef = t.data_destinatario;
          const solicitanteNome = (t.solicitante as any)?.nome || "Solicitante";
          const destinatarioNome = (t.destinatario as any)?.nome || "Destinatário";

          pendenciasList.push({
            id: `troca-${t.id}`,
            tipo: "troca",
            titulo: "Troca de folga pendente",
            descricao: `${solicitanteNome} → ${destinatarioNome} (${new Date(dataRef).toLocaleDateString("pt-BR")})`,
            data_referencia: dataRef,
            rota_resolver: "/admin/solicitacoes",
            identificador_unico: chave,
          });
        });
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

      // Mês anterior
      const mesAnterior = mesVigente === 1 ? 12 : mesVigente - 1;
      const anoAnterior = mesVigente === 1 ? anoVigente - 1 : anoVigente;

      // Para cada unidade, verificar se há documentos importados
      for (const unidade of unidades) {
        // Contracheque (a partir do dia 10, referente ao mês anterior)
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
              pendenciasList.push({
                id: chave,
                tipo: "contracheque",
                titulo: "Contracheque não importado",
                descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
                data_referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`,
                rota_resolver: "/admin/documentos/contracheque",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }

        // Adiantamento (a partir do dia D+5, referente ao mês vigente)
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
                pendenciasList.push({
                  id: chave,
                  tipo: "adiantamento",
                  titulo: "Adiantamento não importado",
                  descricao: `${unidade.nome} - ${String(mesVigente).padStart(2, "0")}/${anoVigente}`,
                  data_referencia: `${anoVigente}-${String(mesVigente).padStart(2, "0")}-01`,
                  rota_resolver: "/admin/documentos/adiantamento",
                  unidade_id: unidade.id,
                  identificador_unico: chave,
                });
              }
            }
          }
        }

        // Folha de ponto (a partir do dia 10, referente ao mês anterior, apenas se unidade tem relógio)
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
              pendenciasList.push({
                id: chave,
                tipo: "folha_ponto",
                titulo: "Folha de ponto não importada",
                descricao: `${unidade.nome} - ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
                data_referencia: `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`,
                rota_resolver: "/admin/documentos/ponto",
                unidade_id: unidade.id,
                identificador_unico: chave,
              });
            }
          }
        }
      }

      // 4. Negociações coletivas (data base > 365 dias)
      const { data: negociacoes, error: negError } = await supabase
        .from("negociacoes")
        .select("ano, mes, created_at")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false })
        .limit(1);

      if (negError) throw negError;

      if (negociacoes && negociacoes.length > 0) {
        const ultima = negociacoes[0];
        const dataBase = new Date(ultima.ano, ultima.mes - 1, 1);
        const diffDias = Math.floor((hoje.getTime() - dataBase.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDias >= 365) {
          const chave = `negociacao-${ultima.ano}-${ultima.mes}`;
          if (!chaveAdiados.has(chave)) {
            pendenciasList.push({
              id: chave,
              tipo: "negociacao",
              titulo: "Negociação coletiva pendente",
              descricao: `Última negociação: ${String(ultima.mes).padStart(2, "0")}/${ultima.ano} (${diffDias} dias atrás)`,
              data_referencia: `${ultima.ano}-${String(ultima.mes).padStart(2, "0")}-01`,
              rota_resolver: "/admin/documentos/act-cct",
              identificador_unico: chave,
            });
          }
        }
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