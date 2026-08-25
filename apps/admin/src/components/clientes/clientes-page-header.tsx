"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ImportClientesDialog } from "./import-clientes-dialog";

/**
 * Encabezado de la lista de clientes. Mantiene el estado del diálogo de
 * importación para poder abrirlo desde el menú de acciones (en móvil) o desde
 * el botón "Importar" (en escritorio).
 */
export function ClientesPageHeader({ canCreate }: { canCreate: boolean }) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Gestiona los clientes del vivero"
        actions={
          canCreate
            ? [
                {
                  label: "Importar",
                  icon: "upload",
                  onClick: () => setImportOpen(true),
                },
                {
                  label: "Nuevo Cliente",
                  href: "/dashboard/clientes/nuevo",
                  icon: "plus",
                  primary: true,
                },
              ]
            : []
        }
      />
      {canCreate && (
        <ImportClientesDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          showTrigger={false}
        />
      )}
    </>
  );
}
