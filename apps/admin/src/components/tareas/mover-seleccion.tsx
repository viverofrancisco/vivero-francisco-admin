"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputNumero } from "@/components/ui/input-numero";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  ChevronDown,
} from "lucide-react";
import type { Destino } from "./orden-tareas";

/**
 * Mover las tareas marcadas de a varias, sin arrastrarlas.
 *
 * Arrastrar sirve para correr una fila un par de lugares; para mandar cinco al
 * principio de una lista de cien es un viaje largo con el botón apretado, y
 * basta soltar antes de tiempo para tener que empezar de nuevo. Es el mismo
 * menú que usa Shopify para ordenar una colección a mano.
 *
 * Son dos presentaciones de lo mismo: un menú anclado al botón en escritorio y
 * un cajón desde abajo en el teléfono, donde está el pulgar. Las opciones viven
 * en `Opciones` una sola vez.
 */

interface PropsComunes {
  cuantas: number;
  /** Cuántas tareas hay en total, para no aceptar una posición que no existe. */
  total: number;
  onMover: (destino: Destino) => void;
}

/** Escritorio: un menú anclado al botón. */
export function MoverSeleccion({ cuantas, total, onMover }: PropsComunes) {
  const [abierto, setAbierto] = useState(false);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" disabled={cuantas === 0} />}
      >
        Mover
        <ChevronDown className="ml-1 h-4 w-4" />
      </PopoverTrigger>
      {/* Un `Popover` y no un `DropdownMenu` porque una de las opciones tiene un
          campo adentro: en un menú, escribir un número lo cierra. */}
      <PopoverContent align="end" className="w-64 p-1.5">
        <Opciones
          total={total}
          onMover={(d) => {
            setAbierto(false);
            onMover(d);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Teléfono: un botón a secas —sin la flechita de desplegable, que promete un
 * menú anclado que no es lo que va a pasar— y las opciones en un cajón.
 */
export function MoverSeleccionMovil({
  cuantas,
  total,
  onMover,
  className,
}: PropsComunes & { className?: string }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Button
        size="sm"
        disabled={cuantas === 0}
        className={className}
        onClick={() => setAbierto(true)}
      >
        Mover
      </Button>
      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>
              {cuantas === 1 ? "Mover 1 tarea" : `Mover ${cuantas} tareas`}
            </SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-4">
            <Opciones
              total={total}
              comodo
              onMover={(d) => {
                setAbierto(false);
                onMover(d);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function Opciones({
  total,
  onMover,
  comodo = false,
}: {
  total: number;
  onMover: (destino: Destino) => void;
  /** Renglones grandes, para el dedo. */
  comodo?: boolean;
}) {
  const [posicion, setPosicion] = useState("1");

  const n = Number(posicion);
  const posicionValida = Number.isInteger(n) && n >= 1 && n <= total;

  const fila = comodo
    ? "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-sm hover:bg-muted"
    : "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted";

  return (
    <>
      <button type="button" className={fila} onClick={() => onMover("inicio")}>
        <ArrowUpToLine className="h-4 w-4 flex-none text-muted-foreground" />
        Al principio
      </button>
      <button type="button" className={fila} onClick={() => onMover("fin")}>
        <ArrowDownToLine className="h-4 w-4 flex-none text-muted-foreground" />
        Al final
      </button>
      <form
        className={
          comodo
            ? "flex items-center gap-3 px-3 py-2"
            : "flex items-center gap-2 px-2.5 py-2"
        }
        onSubmit={(e) => {
          e.preventDefault();
          if (posicionValida) onMover(n);
        }}
      >
        <ArrowRight className="h-4 w-4 flex-none text-muted-foreground" />
        <span className="flex-none text-sm">A la posición</span>
        <InputNumero
          value={posicion}
          onChange={setPosicion}
          className={`flex-none text-center ${comodo ? "h-10 w-16" : "h-8 w-14"}`}
          aria-label="Posición de destino"
        />
        <Button
          type="submit"
          size={comodo ? "default" : "sm"}
          disabled={!posicionValida}
        >
          Mover
        </Button>
      </form>
    </>
  );
}
