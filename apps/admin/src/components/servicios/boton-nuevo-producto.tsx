"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * El encabezado del listado, con la pregunta del tipo en un diálogo.
 *
 * El tipo hay que elegirlo antes de la ficha —es lo único que no se puede
 * cambiar después, y decide qué campos tiene la pantalla— pero eso no amerita
 * una página propia: son dos opciones y una decisión de un segundo. Como
 * diálogo se responde sin salir del listado, y quien se arrepiente cierra en
 * vez de tener que volver.
 */
export function ProductosHeader() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const elegir = (tipo: "SERVICIO" | "BIEN") => {
    setAbierto(false);
    router.push(`/dashboard/productos/nuevo?tipo=${tipo}`);
  };

  return (
    <>
      <PageHeader
        title="Productos"
        actions={[
          {
            label: "Nuevo producto",
            onClick: () => setAbierto(true),
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>¿Qué vas a cargar?</DialogTitle>
            <DialogDescription>
              No se puede cambiar después, y de esto depende lo que se le puede
              poner.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Opcion
              titulo="Servicio"
              detalle="Un trabajo o una mano de obra."
              nota="No se cuenta ni se guarda: no lleva inventario."
              onClick={() => elegir("SERVICIO")}
            />
            <Opcion
              titulo="Bien"
              detalle="Un producto físico que se entrega."
              nota="Se cuenta, y puede venir en variantes: color, tamaño."
              onClick={() => elegir("BIEN")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Opcion({
  titulo,
  detalle,
  nota,
  onClick,
}: {
  titulo: string;
  detalle: string;
  nota: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
    >
      <p className="font-medium">{titulo}</p>
      {/* El detalle crece y la nota queda abajo: así las dos tarjetas alinean
          sus títulos y sus notas aunque el texto del medio ocupe distinto. */}
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{detalle}</p>
      <p className="mt-2 text-xs text-muted-foreground">{nota}</p>
    </button>
  );
}
