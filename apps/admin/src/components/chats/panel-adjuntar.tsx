"use client";

import { useState, type ComponentType } from "react";
import { CalendarDays, Camera, FileText, Images, Plus, Tag, Users } from "lucide-react";
import type { TipoDeReferencia } from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type OpcionDeAdjuntar = "camara" | "fotos" | "documento" | TipoDeReferencia;

/**
 * El **+** del chat: lo que se puede mandar además de texto, como en WhatsApp.
 *
 * Una grilla de círculos con su nombre debajo —cámara, fotos y videos,
 * documento, y las fichas que se comparten como un contacto— y no un menú de
 * renglones: seis cosas distintas se reconocen por el dibujo y el color antes
 * que por la palabra, y en cuatro por fila entran en una mano. En el
 * escritorio cuelga del botón, hacia arriba (WhatsApp Desktop); en el teléfono
 * es una hoja desde abajo. La app tiene la misma grilla (`PanelAdjuntar`).
 *
 * Reemplaza al clip y al botón de la foto, que eran dos porque el selector del
 * sistema filtra por tipo: siguen siendo dos `input` escondidos, pero un solo
 * botón que los abre. Cada color es uno de los del gráfico, para no inventar.
 */
const OPCIONES: {
  clave: OpcionDeAdjuntar;
  etiqueta: string;
  Icono: ComponentType<{ className?: string }>;
  color: string;
  /** La cámara del teléfono: en el escritorio el `capture` no hace nada. */
  soloMovil?: boolean;
  /** Un jardinero no ve clientes ni productos. */
  soloOficina?: boolean;
}[] = [
  { clave: "camara", etiqueta: "Cámara", Icono: Camera, color: "text-muted-foreground", soloMovil: true },
  { clave: "fotos", etiqueta: "Multimedia", Icono: Images, color: "text-chart-2" },
  { clave: "documento", etiqueta: "Documento", Icono: FileText, color: "text-chart-5" },
  { clave: "visita", etiqueta: "Visita", Icono: CalendarDays, color: "text-chart-1" },
  { clave: "cliente", etiqueta: "Cliente", Icono: Users, color: "text-chart-3", soloOficina: true },
  { clave: "producto", etiqueta: "Producto", Icono: Tag, color: "text-chart-4", soloOficina: true },
];

export function PanelAdjuntar({
  esOficina,
  disabled,
  onElegir,
}: {
  esOficina: boolean;
  disabled?: boolean;
  onElegir: (opcion: OpcionDeAdjuntar) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const opciones = OPCIONES.filter((o) => esOficina || !o.soloOficina);

  return (
    <>
      {/* Escritorio: colgado del botón, hacia arriba. */}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-9 w-9 flex-none text-muted-foreground md:inline-flex"
              aria-label="Adjuntar"
              disabled={disabled}
            />
          }
        >
          <Plus className="h-6 w-6" />
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-auto p-3">
          <Grilla
            opciones={opciones.filter((o) => !o.soloMovil)}
            onElegir={onElegir}
          />
        </PopoverContent>
      </Popover>

      {/* Teléfono: una hoja desde abajo, con las celdas para el pulgar. */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 flex-none text-muted-foreground md:hidden"
        aria-label="Adjuntar"
        disabled={disabled}
        onClick={() => setAbierto(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="rounded-t-2xl px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="sr-only">Adjuntar</SheetTitle>
          <Grilla
            opciones={opciones}
            comodo
            onElegir={(o) => {
              // Cerrar primero: la elección abre el selector del sistema o
              // otro diálogo, y la hoja no tiene que quedar debajo.
              setAbierto(false);
              onElegir(o);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function Grilla({
  opciones,
  comodo = false,
  onElegir,
}: {
  opciones: typeof OPCIONES;
  /** Celdas más grandes, para el dedo. */
  comodo?: boolean;
  onElegir: (opcion: OpcionDeAdjuntar) => void;
}) {
  return (
    <div className={cn("grid grid-cols-4 justify-items-center", comodo ? "gap-y-4" : "gap-x-1 gap-y-2")}>
      {opciones.map(({ clave, etiqueta, Icono, color }) => (
        <button
          key={clave}
          type="button"
          onClick={() => onElegir(clave)}
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-lg py-1 text-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
            comodo ? "w-[76px] text-[13px]" : "w-[76px] text-xs"
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-muted",
              comodo ? "h-[60px] w-[60px]" : "h-14 w-14"
            )}
          >
            <Icono className={cn("h-6 w-6", color)} />
          </span>
          <span className="text-center leading-tight">{etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
