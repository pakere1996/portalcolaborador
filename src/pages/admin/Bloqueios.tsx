/* Enhance visual feedback for occupancy status */
<div className="space-y-4">
  <div className="flex items-center justify-between gap-4">
    <div>
      <h2 className="text-lg font-semibold">Ocupação por Dia</h2>
    </div>
    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
      {loading ? "Carregando..." : "Atualizar"}
    </Badge>
  </div>

  {loading ? (
    <div className="flex items-center justify-center rounded-2xl border p-12 text-muted-foreground">
      <Loader2 className="size-6 animate-spin mr-2" /> Carregando...
    </div>
  ) : filteredAtestados.length === 0 ? (
    <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
      Nenhum atestado encontrado.
    </div>
  ) : (
    <div className="grid gap-4">
      {filteredAtestados.map((a) => (
        <div key={a.id} className="rounded-2xl border bg-card p-4 space-y-4">
          {/* ... existing content ... */}
          <div className="flex items-center gap-2">
            <Badge className={cn(
              "border",
              a.status === 'pendente' ? "bg-pending/20 text-pending-foreground border-pending/40" :
              a.status === 'aprovada' ? "bg-available/20 text-available border-available/40" :
              "bg-muted text-muted-foreground border-border"
            )}>
              {a.status}
            </Badge>
            <span className="text-xs text-muted-foreground mt-1 d-block">
              {new Date(a.created_at).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      ))}
    </div>
  )}
</div>