import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Unidade } from "@/integrations/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check, X, Building2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cleanCNPJ, formatCNPJ, validateCNPJFormat, maskCNPJ } from "@/lib/utils";

export const Route = createFileRoute("/admin/Unidades")({
  component: UnidadesPage,
});

const unidadeSchema = z.object({
  nome: z.string().min(2, "O nome é obrigatório."),
  cnpj: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    const cleaned = cleanCNPJ(val);
    // Check if it's 14 digits and if it matches the formatted pattern XX.XXX.XXX/XXXX-XX
    return cleaned.length === 14 && validateCNPJFormat(formatCNPJ(cleaned));
  }, {
    message: "CNPJ inválido. Use o formato XX.XXX.XXX/XXXX-XX.",
  }).transform((val) => val ? formatCNPJ(cleanCNPJ(val)) : null),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  ativo: z.boolean(),
});

type UnidadeFormValues = z.infer<typeof unidadeSchema>;

const fetchUnidades = async (): Promise<Unidade[]> => {
  const { data, error } = await supabase
    .from("unidades")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data;
};

const upsertUnidade = async (values: UnidadeFormValues, id?: string) => {
  const payload = {
    ...values,
    cnpj: values.cnpj || null,
  };

  if (id) {
    const { error } = await supabase
      .from("unidades")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("unidades").insert(payload);
    if (error) throw error;
  }
};

const deleteUnidade = async (id: string) => {
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) throw error;
};

function UnidadeFormDialog({
  unidade,
  open,
  onOpenChange,
}: {
  unidade?: Unidade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!unidade;

  const defaultValues: UnidadeFormValues = useMemo(() => ({
    nome: unidade?.nome || "",
    cnpj: unidade?.cnpj || "",
    endereco: unidade?.endereco || "",
    cidade: unidade?.cidade || "",
    telefone: unidade?.telefone || "",
    ativo: unidade?.ativo ?? true,
  }), [unidade]);

  const form = useForm<UnidadeFormValues>({
    resolver: zodResolver(unidadeSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: UnidadeFormValues) => upsertUnidade(values, unidade?.id),
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Unidade atualizada com sucesso!"
          : "Unidade criada com sucesso!"
      );
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar unidade:", error);
      toast.error("Erro ao salvar unidade.", {
        description: error.message,
      });
    },
  });

  const onSubmit = (values: UnidadeFormValues) => {
    mutation.mutate(values);
  };

  // Handle CNPJ input masking
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const rawValue = cleanCNPJ(e.target.value);
    if (rawValue.length <= 14) {
      field.onChange(formatCNPJ(rawValue));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Unidade" : "Nova Unidade"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Unidade</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      onChange={(e) => handleCnpjChange(e, field)}
                      maxLength={18}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
I apologize for the interruption. I will continue writing the `src/pages/admin/Unidades.tsx` file where I left off, and then proceed with the remaining steps.

### Step 4: Update Unit Management Form (`src/pages/admin/Unidades.tsx`) - Continued

I will complete the `UnidadeFormDialog` and the main `UnidadesPage` component, ensuring the CNPJ is displayed in the table and handled in the form.

<dyad-write path="src/pages/admin/Unidades.tsx" description="Completing the Unidades page update to include CNPJ field in the form and display.">
import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Unidade } from "@/integrations/supabase/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check, X, Building2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cleanCNPJ, formatCNPJ, validateCNPJFormat, maskCNPJ } from "@/lib/utils";

export const Route = createFileRoute("/admin/Unidades")({
  component: UnidadesPage,
});

const unidadeSchema = z.object({
  nome: z.string().min(2, "O nome é obrigatório."),
  cnpj: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    const cleaned = cleanCNPJ(val);
    // Check if it's 14 digits and if it matches the formatted pattern XX.XXX.XXX/XXXX-XX
    return cleaned.length === 14 && validateCNPJFormat(formatCNPJ(cleaned));
  }, {
    message: "CNPJ inválido. Use o formato XX.XXX.XXX/XXXX-XX.",
  }).transform((val) => val ? formatCNPJ(cleanCNPJ(val)) : null),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  ativo: z.boolean(),
});

type UnidadeFormValues = z.infer<typeof unidadeSchema>;

const fetchUnidades = async (): Promise<Unidade[]> => {
  const { data, error } = await supabase
    .from("unidades")
    .select("*")
    .order("nome");
  if (error) throw error;
  return data;
};

const upsertUnidade = async (values: UnidadeFormValues, id?: string) => {
  const payload = {
    ...values,
    cnpj: values.cnpj || null,
  };

  if (id) {
    const { error } = await supabase
      .from("unidades")
      .update(payload)
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("unidades").insert(payload);
    if (error) throw error;
  }
};

const deleteUnidade = async (id: string) => {
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) throw error;
};

function UnidadeFormDialog({
  unidade,
  open,
  onOpenChange,
}: {
  unidade?: Unidade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!unidade;

  const defaultValues: UnidadeFormValues = useMemo(() => ({
    nome: unidade?.nome || "",
    cnpj: unidade?.cnpj || "",
    endereco: unidade?.endereco || "",
    cidade: unidade?.cidade || "",
    telefone: unidade?.telefone || "",
    ativo: unidade?.ativo ?? true,
  }), [unidade]);

  const form = useForm<UnidadeFormValues>({
    resolver: zodResolver(unidadeSchema),
    defaultValues,
  });

  const mutation = useMutation({
    mutationFn: (values: UnidadeFormValues) => upsertUnidade(values, unidade?.id),
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Unidade atualizada com sucesso!"
          : "Unidade criada com sucesso!"
      );
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar unidade:", error);
      toast.error("Erro ao salvar unidade.", {
        description: error.message,
      });
    },
  });

  const onSubmit = (values: UnidadeFormValues) => {
    mutation.mutate(values);
  };

  // Handle CNPJ input masking
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const rawValue = cleanCNPJ(e.target.value);
    if (rawValue.length <= 14) {
      field.onChange(formatCNPJ(rawValue));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Unidade" : "Nova Unidade"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Unidade</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ (Opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="XX.XXX.XXX/XXXX-XX"
                      onChange={(e) => handleCnpjChange(e, field)}
                      maxLength={18}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ativo"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Unidade Ativa</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function UnidadesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | undefined>(
    undefined
  );
  const queryClient = useQueryClient();

  const { data: unidades, isLoading } = useQuery({
    queryKey: ["unidades"],
    queryFn: fetchUnidades,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUnidade,
    onSuccess: () => {
      toast.success("Unidade excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["unidades"] });
    },
    onError: (error) => {
      console.error("Erro ao excluir unidade:", error);
      toast.error("Erro ao excluir unidade.", {
        description: error.message,
      });
    },
  });

  const handleEdit = (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setSelectedUnidade(undefined);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a unidade "${nome}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="size-7 text-pakere-red" /> Gestão de Unidades
        </h1>
        <Button onClick={handleNew}>
          <Plus className="size-4 mr-2" /> Nova Unidade
        </Button>
      </div>

      <UnidadeFormDialog
        unidade={selectedUnidade}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Carregando unidades...
                </TableCell>
              </TableRow>
            ) : (
              unidades?.map((unidade) => (
                <TableRow key={unidade.id}>
                  <TableCell className="font-medium">{unidade.nome}</TableCell>
                  <TableCell>{maskCNPJ(unidade.cnpj)}</TableCell>
                  <TableCell>{unidade.cidade || "N/A"}</TableCell>
                  <TableCell>
                    {unidade.ativo ? (
                      <span className="flex items-center text-green-600">
                        <Check className="size-4 mr-1" /> Ativa
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600">
                        <X className="size-4 mr-1" /> Inativa
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(unidade)}
                    >
                      <Edit className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(unidade.id, unidade.nome)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}