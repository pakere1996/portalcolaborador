import { createServerFn } from "@tanstack/react-start";
import { getSupabaseServerClient } from "@/integrations/supabase/server-client";
import { DocumentImportForm } from "@/components/DocumentImportForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Upload } from "lucide-react";

export async function index() {
  const supabase = getSupabaseServerClient();
  
  // Verify user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Response("Não autenticado", { status: 401 });
  }

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    throw new Response("Acesso negado", { status: 403 });
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestão de Documentos</h1>
        <p className="text-muted-foreground">
          Importe e gerencie documentos do sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Novo Documento
          </CardTitle>
          <CardDescription>
            Envie documentos para processamento em lote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Nenhum documento importado recentemente
          </p>
        </CardContent>
      </Card>
    </div>
  );
}