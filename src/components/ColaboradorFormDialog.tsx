import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Profile, Unidade } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { maskCNPJ } from "@/lib/utils"; // Import maskCNPJ

const formSchema = z.object({
  nome: z.string().min(2, { message: "O nome deve ter pelo menos 2 caracteres." }),
  cpf: z.string().min(11, { message: "CPF inválido." }),
  cargo: z.string().min(1, { message: "O cargo é obrigatório." }),
  matricula: z.string().optional(),
  ativo: z.boolean(),
  data_admissao: z.date().optional().nullable(),
  data_nascimento: z.date().optional().nullable(),
  folga_fixa_semana: z.string().optional().nullable(),
  unidade_id: z.string().uuid({ message: "A unidade é obrigatória." }), // Made mandatory
  endereco: z.string().optional().nullable(),
  email_contato: z.string().email("Email inválido.").optional().nullable(),
  whatsapp: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof formSchema>;

interface ColaboradorFormDialogProps {
  profile?: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fetchUnidades = async (): Promise<Unidade[]> => {
  const { data, error } = await supabase
    .from("unidades")
    .select("*")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return data;
};

const upsertProfile = async (values: ProfileFormValues, profileId?: string) => {
  const payload = {
    ...values,
    data_admissao: values.data_admissao ? format(values.data_admissao, "yyyy-MM-dd") : null,
    data_nascimento: values.data_nascimento ? format(values.data_nascimento, "yyyy-MM-dd") : null,
    folga_fixa_semana: values.folga_fixa_semana ? parseInt(values.folga_fixa_semana) : null,
    unidade_id: values.unidade_id,
  };

  if (profileId) {
    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profileId);
    if (error) throw error;
  } else {
    // This path is usually for admin creating a profile linked to an existing auth.user
    // For simplicity here, we assume the profile already exists or is being created via a different flow (like signup)
    // Since this component is used in Admin/Colaboradores, we'll assume we are updating an existing profile or creating a placeholder.
    // However, the current schema requires an auth.user ID. We'll keep the update logic for now.
    throw new Error("Criação de novo colaborador via formulário não suportada diretamente. Use o fluxo de aprovação.");
  }
};

export function ColaboradorFormDialog({
  profile,
  open,
  onOpenChange,
}: ColaboradorFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!profile;

  const { data: unidades } = useQuery<Unidade[]>({
    queryKey: ["unidades"],
    queryFn: fetchUnidades,
  });

  const defaultValues: ProfileFormValues = {
    nome: profile?.nome || "",
    cpf: profile?.cpf || "",
    cargo: profile?.cargo || "",
    matricula: profile?.matricula || "",
    ativo: profile?.ativo ?? true,
    data_admissao: profile?.data_admissao ? new Date(profile.data_admissao) : null,
    data_nascimento: profile?.data_nascimento ? new Date(profile.data_nascimento) : null,
    folga_fixa_semana: profile?.folga_fixa_semana?.toString() || "",
    unidade_id: profile?.unidade_id || "", // Initialize with existing or empty string
    endereco: profile?.endereco || "",
    email_contato: profile?.email_contato || "",
    whatsapp: profile?.whatsapp || "",
  };

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Reset form when dialog opens/profile changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, profile]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => upsertProfile(values, profile?.id),
    onSuccess: () => {
      toast.success(
        isEdit
          ? "Colaborador atualizado com sucesso!"
          : "Colaborador criado com sucesso!"
      );
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Erro ao salvar colaborador:", error);
      toast.error("Erro ao salvar colaborador.", {
        description: error.message,
      });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar Colaborador" : "Novo Colaborador"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isEdit} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cargo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="matricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unidade_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unidade *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a unidade" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {unidades?.map((unidade) => (
                          <SelectItem key={unidade.id} value={unidade.id}>
                            {unidade.nome} - {maskCNPJ(unidade.cnpj)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="folga_fixa_semana"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Folga Fixa Semanal (Opcional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Nenhuma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Domingo</SelectItem>
                        <SelectItem value="1">Segunda-feira</SelectItem>
                        <SelectItem value="2">Terça-feira</SelectItem>
                        <SelectItem value="3">Quarta-feira</SelectItem>
                        <SelectItem value="4">Quinta-feira</SelectItem>
                        <SelectItem value="5">Sexta-feira</SelectItem>
                        <SelectItem value="6">Sábado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_admissao"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Admissão (Opcional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_nascimento"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Nascimento (Opcional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email_contato"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Contato (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp (Opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    <FormLabel>Colaborador Ativo</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Salvando..."
                : isEdit
                ? "Salvar Alterações"
                : "Criar Colaborador"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default ColaboradorFormDialog;