import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DocumentImportForm } from "@/components/DocumentImportForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Upload, History, Download, Pencil, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Documento {
  id: string;
  colaborador_id: string;
  tipo: string;
  mes: number;
  ano: number;
  storage_path: string;
  status: string;
  nome_pdf: string | null;
  created_at: string;
}

interface Profile { id: string; nome: string; }

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function DocumentosPonto() {
  const [aba, setAba] = useState<"importar" | "historico">("importar");
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroColab, setFiltroColab] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");
  const [filtroAno, setFiltroAno] = useState("todos");
  const [editando, setEditando] = useState<string | null>(null);
  const [editMes, setEditMes] = useState("");
  const [editAno, setEditAno] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: docs }, { data: profs }] = await Promise.all([
      supabase.from("documentos").select("*").eq("tipo", "folha_ponto").order("ano", { ascending: false }).order("mes", { ascending: false }),
      supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setDocumentos(docs ?? []);
    setProfiles(profs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDownload = async (path: string) => {
    const { data } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("Erro ao gerar link de download");
  };

  const handleEditSave = async (id: string) => {
    if (!editMes || !editAno) return toast.error("Mês e ano são obrigatórios");
    setBusy(true);
    const { error } = await supabase.from("documentos").update({ mes: parseInt(editMes), ano: parseInt(editAno) }).eq("id", id);
    if (error) toast.error("Erro ao atualizar", { description: error.message });
    else { toast.success("Competência atualizada!"); setEditando(null); load(); }
    setBusy(false);
  };

  const anos = [...new Set(documentos.map(d => d.ano))].sort((a, b) => b - a);

  const filtrados = documentos.filter(d => {
    if (filtroColab !== "todos" && d.colaborador_id !== filtroColab) return false;
    if (filtroMes !== "todos" && d.mes !== parseInt(filtroMes)) return false;
    if (filtroAno !== "todos" && d.ano !== parseInt(filtroAno)) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Clock className="size-6 text-primary" /> Folhas de Ponto
        </h1>
        <p className="text-muted-foreground mt-1">Importe e gerencie as folhas de ponto dos colaboradores.</p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button onClick={() => setAba("importar")} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba === "importar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Upload className="size-4" /> Importar
        </button>
        <button onClick={() => { setAba("historico"); load(); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${aba === "historico" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <History className="size-4" /> Histórico
        </button>
      </div>

      {aba === "importar" && (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5 text-primary" /> Importar Folhas de Ponto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentImportForm />
          </CardContent>
        </Card>
      )}

      {aba === "historico" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3">
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Colaborador</Label>
              <Select value={filtroColab} onValueChange={setFiltroColab}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-[140px]">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Mês</Label>
              <Select value={filtroMes} onValueChange={setFiltroMes}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 w-[120px]">
              <Label className="text-xs uppercase text-muted-foreground font-bold">Ano</Label>
              <Select value={filtroAno} onValueChange={setFiltroAno}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anos.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
              Nenhuma folha de ponto encontrada.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Colaborador</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground">Competência</th>
                    <th className="text-left p-4 font-bold uppercase text-[10px] text-muted-foreground hidden md:table-cell">Arquivo</th>
                    <th className="text-center p-4 font-bold uppercase text-[10px] text-muted-foreground">Status</th>
                    <th className="text-right p-4 font-bold uppercase text-[10px] text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map(d => (
                    <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">{profiles.find(p => p.id === d.colaborador_id)?.nome ?? "—"}</td>
                      <td className="p-4">
                        {editando === d.id ? (
                          <div className="flex items-center gap-2">
                            <Select value={editMes} onValueChange={setEditMes}>
                              <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="Mês" /></SelectTrigger>
                              <SelectContent>
                                {MESES.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input className="w-[90px] h-8" placeholder="Ano" value={editAno} onChange={e => setEditAno(e.target.value)} maxLength={4} />
                            <Button size="icon" className="size-8" onClick={() => handleEditSave(d.id)} disabled={busy}>
                              {busy ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditando(null)}>
                              <X className="size-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="font-mono">{String(d.mes).padStart(2,"0")}/{d.ano}</span>
                        )}
                      </td>
                      <td className="p-4 hidden md:table-cell text-muted-foreground text-xs truncate max-w-[200px]">{d.nome_pdf ?? "—"}</td>
                      <td className="p-4 text-center">
                        <Badge className={d.status === "vinculado" ? "bg-green-100 text-green-700 border-green-200" : "bg-muted text-muted-foreground"}>
                          {d.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" title="Editar competência" onClick={() => { setEditando(d.id); setEditMes(String(d.mes)); setEditAno(String(d.ano)); }}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" title="Baixar" onClick={() => handleDownload(d.storage_path)}>
                            <Download className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}