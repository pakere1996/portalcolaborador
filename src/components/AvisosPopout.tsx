// Dentro do DialogContent, após a mensagem:
{avisoAtual.anexo_path && (
  <div className="mt-3">
    <Button 
      variant="outline" 
      size="sm" 
      className="w-full"
      onClick={async () => {
        const { data } = await supabase.storage
          .from("documentos_admin")
          .createSignedUrl(avisoAtual.anexo_path!, 60);
        if (data?.signedUrl) window.open(data.signedUrl, "_blank");
      }}
    >
      <FileText className="size-4 mr-2" /> Ver anexo
    </Button>
  </div>
)}