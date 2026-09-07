"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Loader2, StickyNote } from "lucide-react";

type Motivo = "CONTEO" | "AJUSTE" | "INGRESO";

/** Cómo se lee un movimiento que todavía no se guardó. */
function textoPendiente(p: { motivo: Motivo; valor: number }): string {
  if (p.motivo === "CONTEO") return `poner en ${p.valor}`;
  if (p.motivo === "INGRESO") return `entran ${Math.abs(p.valor)}`;
  return `${p.valor > 0 ? "+" : ""}${p.valor}`;
}

const MOTIVOS: { valor: Motivo; etiqueta: string }[] = [
  { valor: "CONTEO", etiqueta: "Poner en" },
  { valor: "AJUSTE", etiqueta: "Sumar" },
  { valor: "INGRESO", etiqueta: "Entró" },
];

/**
 * Mover el stock de una variante, en un popover pegado al número.
 *
 * Es el de Shopify: se toca la cantidad y se edita ahí, sin tapar la pantalla.
 * Un diálogo para escribir un número obliga a perder de vista la lista que se
 * estaba mirando, que es justamente lo que dice si el número está bien.
 *
 * **El stock no se escribe suelto.** Toda edición pasa por acá porque toda
 * edición es un movimiento del libro: qué pasó, cuánto y por qué. Un input
 * inline no tiene dónde poner el "qué pasó".
 */
export function PopoverStock({
  stock,
  permiteNegativo,
  pendiente,
  onMover,
  children,
}: {
  /** Lo que hay **guardado**, no lo proyectado. */
  stock: number;
  permiteNegativo: boolean;
  /**
   * El movimiento que ya estaba sin guardar, si lo hay.
   *
   * Se muestra y **se reemplaza**: dos movimientos sobre la misma variante
   * antes de guardar no se acumulan. Apilarlos obligaría a explicar de qué
   * número parte cada uno, y la respuesta útil —"va a quedar en 12"— ya está a
   * la vista en la fila.
   */
  pendiente?: { motivo: Motivo; valor: number; nota: string | null };
  /** Devuelve el saldo nuevo. El popover se cierra si no tira. */
  onMover: (m: { motivo: Motivo; valor: number; nota: string | null }) => Promise<void>;
  /** El número, o lo que se toque para abrirlo. */
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState<Motivo>("CONTEO");
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [conNota, setConNota] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const numero = Number(valor);
  const valido =
    valor.trim() !== "" &&
    Number.isInteger(numero) &&
    (motivo === "CONTEO" ? numero >= 0 : numero !== 0);

  /** El saldo que va a quedar, para verlo antes de confirmar. */
  const resultado = !valido
    ? null
    : motivo === "CONTEO"
      ? numero
      : motivo === "INGRESO"
        ? stock + Math.abs(numero)
        : stock + numero;

  const cerrar = () => {
    setAbierto(false);
    setValor("");
    setNota("");
    setConNota(false);
    setMotivo("CONTEO");
  };

  const confirmar = async () => {
    if (!valido) return;
    setGuardando(true);
    try {
      await onMover({ motivo, valor: numero, nota: nota.trim() || null });
      cerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Popover open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}>
      <PopoverTrigger render={children as React.ReactElement} />
      {/* Ancho fijo y no `w-auto`: con el ancho del contenido, la fila se
          apretaba contra el número de la variante y los rótulos se partían. */}
      <PopoverContent align="end" className="w-80 p-2">
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">
            Ahora hay <span className="font-medium text-foreground">{stock}</span>
            {pendiente && (
              <span className="text-amber-700">
                {" "}
                · sin guardar: {textoPendiente(pendiente)}
              </span>
            )}
          </p>
          {/* Todo en una fila: qué pasó, cuánto, la nota y el visto. Partido
              en dos, la mitad de arriba parecía un encabezado y no un campo.

              El desplegable es un `select` **nativo** y no el del portal: ese
              se dibuja fuera del popover, así que Base UI tomaba el clic en una
              opción por uno "afuera" y cerraba todo al elegir. El nativo abre
              en la capa del navegador y no toca el DOM. */}
          <div className="flex items-center gap-1.5">
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as Motivo)}
              aria-label="Qué pasó"
              className="h-8 flex-none rounded-md border bg-background px-1.5 text-sm"
            >
              {MOTIVOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </select>
            <Input
              type="number"
              step="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmar();
                }
              }}
              placeholder={motivo === "AJUSTE" ? "-2" : String(stock)}
              className="h-8 min-w-0 flex-1 text-right tabular-nums"
              autoFocus
            />
            {/* La nota se pide solo si alguien la quiere: la mayoría de los
                conteos no tienen nada que aclarar, y un campo por delante
                convierte "poner 12" en dos decisiones. */}
            <Button
              type="button"
              variant={conNota ? "secondary" : "ghost"}
              size="icon"
              className="flex-none"
              aria-label="Agregar una nota"
              onClick={() => setConNota((v) => !v)}
            >
              <StickyNote className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="flex-none"
              aria-label="Guardar"
              disabled={!valido || guardando}
              onClick={confirmar}
            >
              {guardando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          </div>

          {conNota && (
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmar();
                }
              }}
              placeholder="Por qué"
              className="text-sm"
            />
          )}

          {/* Lo que va a quedar: es la única forma de que "sumar −3" no haya
              que calcularlo de cabeza antes de apretar. */}
          {resultado !== null && resultado !== stock && (
            <p className="px-1 text-xs text-muted-foreground">
              Queda en{" "}
              <span
                className={
                  resultado < 0 && !permiteNegativo
                    ? "font-medium text-destructive"
                    : "font-medium text-foreground"
                }
              >
                {resultado}
              </span>
              {resultado < 0 && !permiteNegativo && " · no se puede dejar en negativo"}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
