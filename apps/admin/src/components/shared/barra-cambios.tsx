"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * La barra que aparece cuando hay cambios sin guardar.
 *
 * Es la de Shopify: en vez de un modo "editar" que hay que abrir y cerrar, los
 * campos se tocan directo y **la barra aparece sola** cuando algo cambió. Un
 * botón *Editar* obliga a decidir que se va a editar antes de saber que se
 * quiere; así, corregir una palabra es tocarla y guardar.
 *
 * Va pegada arriba porque el formulario puede ser más largo que la pantalla, y
 * guardar no puede quedar a un scroll de distancia de lo que se acaba de
 * escribir.
 */
export function BarraCambios({
  hayCambios,
  guardando,
  onGuardar,
  onDescartar,
}: {
  hayCambios: boolean;
  guardando?: boolean;
  onGuardar: () => void;
  onDescartar: () => void;
}) {
  if (!hayCambios) return null;

  return (
    <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-foreground px-4 py-2.5 text-background shadow-sm md:-mx-6 md:px-6">
      <span className="text-sm font-medium">Cambios sin guardar</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDescartar}
          disabled={guardando}
          className="text-background hover:bg-background/15 hover:text-background"
        >
          Descartar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onGuardar}
          disabled={guardando}
          className="bg-background text-foreground hover:bg-background/90"
        >
          {guardando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
