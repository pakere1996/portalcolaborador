import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface Profile {
  id: string;
  nome: string;
  unidade_id: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

const MESES = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function DocumentImportForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const [selectedColaborador, setSelectedColaborador] = useState("");
  const [selectedMes, setSelectedMes] = useState("");
  const [selectedAno, setSelectedAno] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"contracheque" | "ponto">("contracheque");
  const [file, setFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome, unidade_id")
        .eq("ativo", true)
        .order("nome");

      const { data: units } = await supabase
        .from("unidades")
        .select("id, nome")
        .eq("ativo", true);

      setProfiles(profs ?? []);
      setUnidades(units ?? []);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setSelectedColaborador("");
    setSelectedMes("");
    setSelectedAno("");
    setTipoDocumento("contracheque");
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    if (!selectedColaborador) return toast.error("Selecione um colaborador");
    if (!selectedMes) return toast.error("Selecione o mês");
    if (!selectedAno) return toast.error("Selecione o ano");

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const mesStr = String(selectedMes).padStart(2, "0");
      const fileName = `${selectedColaborador}/${selectedAno}/${mesStr}/${tipoDocumento}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const insertData: any = {
        colaborador_id: selectedColaborador,
        tipo: tipoDocumento,
        mes: parseInt(selectedMes),
        ano: parseInt(selectedAno),
        storage_path: fileName,
        nome_pdf: file.name,
        status: "disponivel",
      };

      const { error: insertError } = await supabase
        .from("documentos")
        .insert(insertData);

      if (insertError) throw insertError;

      toast.success("Documento enviado com sucesso!");
      resetForm();
    } catch (error) {
      toast.error("Erro ao enviar", { description: (error as Error).message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Documento</Label>
          <Select
            value={tipoDocumento}
            onValueChange={(v: "contracheque" | "ponto") => setTipoDocumento(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contracheque">Contracheque</SelectItem>
              <SelectItem value="ponto">Folha de Ponto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Colaborador</Label>
          <Select value={selectedColaborador} onValueChange={setSelectedColaborador}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Mês</Label>
          <Select value={selectedMes} onValueChange={setSelectedMes}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Ano</Label>
          <Select value={selectedAno} onValueChange={setSelectedAno}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label>Arquivo PDF</Label>
          <Input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
          {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleUpload} disabled={uploading || !file}>
          {uploading ? (
            <><Loader2 className="size-4 mr-2 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="size-4 mr-2" /> Enviar</>
          )}
        </Button>
        <Button variant="ghost" onClick={resetForm}>Limpar</Button>
      </div>
    </div>
  );
}