<ColaboradorFormDialog
            open={openNewDialog}
            onOpenChange={setOpenNewDialog}
            form={blankEditForm}
            isEdit={false}
            unidades={unidades}
            cargos={cargos}
            busy={busy}
            onSave={loadData}
          />

          {/* Edit Dialog */}
          <ColaboradorFormDialog
            open={!!editingProfile}
            onOpenChange={(open) => { if (!open) setEditingProfile(null); }}
            form={editForm}
            isEdit={true}
            profileToEdit={profileToEditWithRole}
            busy={busy}
            onSave={loadData}
          />