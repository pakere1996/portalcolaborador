import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Check,
  MessageCircle,
} from "lucide-react";
import { FavoritarBotao } from "@/components/FavoritarBotao";
import { cn } from "@/lib/utils";

// --- Formatação ---
const onlyNumbers = (value: string) => value.replace(/\D/g, "");
const formatCNPJ = (value: string) => {
  const clean = onlyNumbers(value);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return clean.replace(/^(\d{2})(\d{0,3})/, "$1.$2");
  if (clean.length <= 8) return clean.replace(/^(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
  if (clean.length <= 12) return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
};
const formatWhatsApp = (value: string) => {
  const clean = onlyNumbers(value);
  if (clean.length <= 2) return clean;
  if (clean.length <= 6) return clean.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  if (clean.length <= 10) return clean.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return clean.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
};

// --- Interfaces ---
interface Sindicato {
  id: string;
  nome: string;
  cnpj: string | null;
  tipo: "laboral" | "patronal" | null;
  contato_whatsapp: string | null;
  created_at: string;
  updated_at: string;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Cargo {
  id: string;
  nome: string;
}

type TipoSindicato = "patronal" | "laboral";

export default function SindicatosCadastro() {
  const { profile } = useAuth();
  const [sindicatos, setSindicatos] = useState<Sindicato[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Estados para o modal de cadastro/edição (reutilizado para ambos)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoEditando, setTipoEditando] = useState<TipoSindicato>("patronal");
  const [editando, setEditando] = useState<Sindicato | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    contato_whatsapp: "",
  });
  const [unidadesSelecionadas, setUnidadesSelecionadas] = useState<string[]>([]);
  const [cargosSelecionados, setCargosSelecionados] = useState<string[]>([]);

  // Confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<Sindicato | null>(null);

  // --- Função para obter dados da unidade do colaborador logado (corrigida) ---
  const getUnidadeDoUsuario = useCallback(async () => {
    // 🔥 Acessa unidade_id via any para evitar erro de tipo
    const unidadeId = (profile as any)?.unidade_id;
    if (!unidadeId) return null;
    const { data, error } = await supabase
      .from("unidades")
      .select("nome, cnpj")
      .eq("id", unidadeId)
      .single();
    if (error) return null;
    return data;
  }, [profile]);

  // --- Abrir WhatsApp com mensagem pré-definida ---
  const abrirWhatsApp = async (sindicato: Sindicato) => {
    const numero = onlyNumbers(sindicato.contato_whatsapp || "");
    if (!numero) {
      toast.warning("Este sindicato não possui número de WhatsApp cadastrado.");
      return;
    }

    const unidade = await getUnidadeDoUsuario();
    const nomeUsuario = profile?.nome || "Colaborador";
    const nomeUnidade = unidade?.nome || "empresa";
    const cnpjUnidade = unidade?.cnpj || "não informado";

    const mensagem = `Olá, me chamo ${nomeUsuario}, da empresa ${nomeUnidade}, CNPJ nº ${cnpjUnidade}. Posso tirar dúvidas com você?`;
    const link = `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`;
    window.open(link, "_blank");
  };

  // --- Loaders ---
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sindRes, unidRes, cargoRes] = await Promise.all([
        supabase.from("sindicatos").select("*").order("nome", { ascending: true }),
        supabase.from("unidades").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
      ]);

      if (sindRes.error) throw sindRes.error;
      if (unidRes.error) throw unidRes.error;
      if (cargoRes.error) throw cargoRes.error;

      setSindicatos(sindRes.data ?? []);
      setUnidades(unidRes.data ?? []);
      setCargos(cargoRes.data ?? []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Handlers de formatação ---
  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, cnpj: formatCNPJ(e.target.value) });
  };
  const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, contato_whatsapp: formatWhatsApp(e.target.value) });
  };

  // --- Abrir modal para novo cadastro ---
  const abrirNovo = (tipo: TipoSindicato) => {
    setTipoEditando(tipo);
    setEditando(null);
    setForm({ nome: "", cnpj: "", contato_whatsapp: "" });
    setUnidadesSelecionadas([]);
    setCargosSelecionados([]);
    setDialogOpen(true);
  };

  // --- Abrir modal para edição ---
  const abrirEdicao = (sindicato: Sindicato) => {
    setTipoEditando(sindicato.tipo as TipoSindicato);
    setEditando(sindicato);
    setForm({
      nome: sindicato.nome,
      cnpj: sindicato.cnpj ? formatCNPJ(sindicato.cnpj) : "",
      contato_whatsapp: sindicato.contato_whatsapp ? formatWhatsApp(sindicato.contato_whatsapp) : "",
    });
    setUnidadesSelecionadas([]);
    setCargosSelecionados([]);
    // Carregar vínculos
    if (sindicato.tipo === "patronal") {
      supabase
        .from("sindicato_unidades")
        .select("unidade_id")
        .eq("sindicato_id", sindicato.id)
        .then(({ data }) => {
          setUnidadesSelecionadas(data?.map(d => d.unidade_id) ?? []);
        });
    } else if (sindicato.tipo === "laboral") {
      supabase
        .from("sindicato_cargos")
        .select("cargo_id")
        .eq("sindicato_id", sindicato.id)
        .then(({ data }) => {
          setCargosSelecionados(data?.map(d => d.cargo_id) ?? []);
        });
    }
    setDialogOpen(true);
  };

  // --- Salvar (criar ou atualizar) ---
  const salvarSindicato = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome do sindicato é obrigatório");
      return;
    }

    // Validações específicas
    if (tipoEditando === "patronal" && unidadesSelecionadas.length === 0) {
      toast.error("Selecione pelo menos uma unidade para o sindicato patronal");
      return;
    }
    if (tipoEditando === "laboral" && cargosSelecionados.length === 0) {
      toast.error("Selecione pelo menos um cargo para o sindicato laboral");
      return;
    }

    setBusy(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        cnpj: form.cnpj ? onlyNumbers(form.cnpj) : null,
        tipo: tipoEditando,
        contato_whatsapp: form.contato_whatsapp ? onlyNumbers(form.contato_whatsapp) : null,
        updated_at: new Date().toISOString(),
      };

      let id: string;
      if (editando) {
        const { error } = await supabase
          .from("sindicatos")
          .update(dados)
          .eq("id", editando.id);
        if (error) throw error;
        id = editando.id;
        toast.success("Sindicato atualizado!");
      } else {
        const { data, error } = await supabase
          .from("sindicatos")
          .insert(dados)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
        toast.success("Sindicato criado!");
      }

      // Atualizar vínculos
      if (tipoEditando === "patronal") {
        await supabase.from("sindicato_unidades").delete().eq("sindicato_id", id);
        if (unidadesSelecionadas.length > 0) {
          const inserts = unidadesSelecionadas.map(unidade_id => ({
            sindicato_id: id,
            unidade_id,
          }));
          await supabase.from("sindicato_unidades").insert(inserts);
        }
      } else {
        await supabase.from("sindicato_cargos").delete().eq("sindicato_id", id);
        if (cargosSelecionados.length > 0) {
          const inserts = cargosSelecionados.map(cargo_id => ({
            sindicato_id: id,
            cargo_id,
          }));
          await supabase.from("sindicato_cargos").insert(inserts);
        }
      }

      setDialogOpen(false);
      setEditando(null);
      setForm({ nome: "", cnpj: "", contato_whatsapp: "" });
      setUnidadesSelecionadas([]);
      setCargosSelecionados([]);
      loadData();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar", { description: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  // --- Excluir ---
  const excluirSindicato = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      // Remover vínculos e documentos (se houver)
      await supabase.from("sindicato_unidades").delete().eq("sindicato_id", confirmDelete.id);
      await supabase.from("sindicato_cargos").delete().eq("sindicato_id", confirmDelete.id);
      // Remover documentos do storage (se houver)
      const { data: docs } = await supabase
        .from("documentos_sindicato")
        .select("storage_path")
        .eq("sindicato_id", confirmDelete.id);
      if (docs && docs.length > 0) {
        const paths = docs.map(d => d.storage_path);
        await supabase.storage.from("sindicatos").remove(paths);
      }
      await supabase.from("documentos_sindicato").delete().eq("sindicato_id", confirmDelete.id);

      const { error } = await supabase
        .from("sindicatos")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;

      toast.success("Sindicato excluído!");
      setConfirmDelete(null);
      loadData();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir sindicato");
    } finally {
      setBusy(false);
    }
  };

  // --- Helpers ---
  const toggleUnidade = (id: string) =>
    setUnidadesSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCargo = (id: string) =>
    setCargosSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const getSindicatosPorTipo = (tipo: TipoSindicato) =>
    sindicatos.filter(s => s.tipo === tipo);

  // --- Renderização ---
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" /> Cadastro de Sindicatos
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie sindicatos patronais e laborais separadamente.
          </p>
        </div>
        <FavoritarBotao rota="/admin/sindicatos/cadastro" label="Cadastro Sindicatos" icone="Building2" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* -------- SINDICATOS PATRONAIS -------- */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-primary">Patronais</h2>
              <Button onClick={() => abrirNovo("patronal")}>
                <Plus className="size-4 mr-2" /> Novo Patronal
              </Button>
            </div>
            {getSindicatosPorTipo("patronal").length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                Nenhum sindicato patronal cadastrado.
              </div>
            ) : (
              <div className="space-y-3">
                {getSindicatosPorTipo("patronal").map(s => (
                  <Card key={s.id} className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{s.nome}</CardTitle>
                        <Badge variant="secondary">Patronal</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {s.cnpj && <div><span className="font-medium">CNPJ:</span> {formatCNPJ(s.cnpj)}</div>}
                      {s.contato_whatsapp && (
                        <div>
                          <span className="font-medium">WhatsApp:</span> {formatWhatsApp(s.contato_whatsapp)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicao(s)}>
                          <Pencil className="size-4 mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setConfirmDelete(s)}>
                          <Trash2 className="size-4 mr-1" /> Excluir
                        </Button>
                        {s.contato_whatsapp && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => abrirWhatsApp(s)}
                          >
                            <MessageCircle className="size-4 mr-1" /> WhatsApp
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* -------- SINDICATOS LABORAIS -------- */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-primary">Laborais</h2>
              <Button onClick={() => abrirNovo("laboral")}>
                <Plus className="size-4 mr-2" /> Novo Laboral
              </Button>
            </div>
            {getSindicatosPorTipo("laboral").length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                Nenhum sindicato laboral cadastrado.
              </div>
            ) : (
              <div className="space-y-3">
                {getSindicatosPorTipo("laboral").map(s => (
                  <Card key={s.id} className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{s.nome}</CardTitle>
                        <Badge variant="default">Laboral</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {s.cnpj && <div><span className="font-medium">CNPJ:</span> {formatCNPJ(s.cnpj)}</div>}
                      {s.contato_whatsapp && (
                        <div>
                          <span className="font-medium">WhatsApp:</span> {formatWhatsApp(s.contato_whatsapp)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button variant="ghost" size="sm" onClick={() => abrirEdicao(s)}>
                          <Pencil className="size-4 mr-1" /> Editar
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setConfirmDelete(s)}>
                          <Trash2 className="size-4 mr-1" /> Excluir
                        </Button>
                        {s.contato_whatsapp && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => abrirWhatsApp(s)}
                          >
                            <MessageCircle className="size-4 mr-1" /> WhatsApp
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de cadastro/edição (reutilizado) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editando ? "Editar" : "Novo"} Sindicato {tipoEditando === "patronal" ? "Patronal" : "Laboral"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Nome do sindicato"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={handleCNPJChange}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={form.contato_whatsapp}
                onChange={handleWhatsAppChange}
                placeholder="(62) 99999-9999"
                maxLength={15}
              />
            </div>

            {tipoEditando === "patronal" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Unidades Representadas *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {unidades.map(un => (
                    <div key={un.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleUnidade(un.id)}
                        className={cn(
                          "size-5 rounded border-2 flex items-center justify-center transition-all",
                          unidadesSelecionadas.includes(un.id)
                            ? "bg-primary border-primary text-white"
                            : "border-muted-foreground/30 hover:border-primary/50"
                        )}
                      >
                        {unidadesSelecionadas.includes(un.id) && <Check className="size-3" />}
                      </button>
                      <Label className="text-sm cursor-pointer">{un.nome}</Label>
                    </div>
                  ))}
                </div>
                {unidadesSelecionadas.length === 0 && (
                  <p className="text-xs text-red-500">* Selecione pelo menos uma unidade</p>
                )}
              </div>
            )}

            {tipoEditando === "laboral" && (
              <div className="space-y-3">
                <Label className="text-base font-semibold">Cargos Representados *</Label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-lg p-3">
                  {cargos.map(cg => (
                    <div key={cg.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCargo(cg.id)}
                        className={cn(
                          "size-5 rounded border-2 flex items-center justify-center transition-all",
                          cargosSelecionados.includes(cg.id)
                            ? "bg-primary border-primary text-white"
                            : "border-muted-foreground/30 hover:border-primary/50"
                        )}
                      >
                        {cargosSelecionados.includes(cg.id) && <Check className="size-3" />}
                      </button>
                      <Label className="text-sm cursor-pointer">{cg.nome}</Label>
                    </div>
                  ))}
                </div>
                {cargosSelecionados.length === 0 && (
                  <p className="text-xs text-red-500">* Selecione pelo menos um cargo</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarSindicato} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
              {editando ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDelete?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os vínculos e documentos associados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirSindicato} className="bg-red-600 text-white hover:bg-red-700">
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}