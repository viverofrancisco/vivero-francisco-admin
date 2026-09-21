"use client";

import { useState } from "react";
import { PageHeader, type HeaderAction } from "@/components/shared/page-header";
import { ImportClientesDialog } from "./import-clientes-dialog";

/**
 * Encabezado de la lista de clientes. Mantiene el estado del diálogo de
 * importación para poder abrirlo desde el menú de acciones (en móvil) o desde
 * el botón "Importar" (en escritorio).
 *
 * Lo renderiza la tabla y no la página: `accionesExtra` trae "Seleccionar
 * clientes", que prende un modo que vive en la tabla.
 */
export function ClientesPageHeader({
  canCreate,
  accionesExtra = [],
}: {
  canCreate: boolean;
  accionesExtra?: HeaderAction[];
}) {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Clientes"
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
                ...accionesExtra,
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
