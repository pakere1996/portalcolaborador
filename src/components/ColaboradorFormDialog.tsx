// Remove the setForm prop from the component signature  export function ColaboradorFormDialog({
    open,
    onOpenChange,
    form,
    isEdit = false,
    profileToEdit,
    unidades,
    cargos,
    busy,
    onSave,
  }: Omit<ColaboradorFormDialogProps, 'setForm'>) {
    // ... rest of the component remains the same
  }