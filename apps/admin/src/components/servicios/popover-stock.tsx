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
  onMover,
  children,
}: {
  stock: number;
  permiteNegativo: boolean;
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
      <PopoverContent align="end" className="w-auto p-2">
        <div className="space-y-2">
          {/* Tres botones y no un desplegable. Con tres opciones el
              desplegable cuesta dos clics para mostrar lo mismo — y el nuestro
              se dibuja en un portal, así que el popover lo tomaba por un clic
              afuera y se cerraba solo al elegir. */}
          <div
            role="radiogroup"
            aria-label="Qué pasó"
            className="flex rounded-md border p-0.5"
          >
            {MOTIVOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                role="radio"
                aria-checked={motivo === m.valor}
                onClick={() => setMotivo(m.valor)}
                className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
                  motivo === m.valor
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {m.etiqueta}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
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
              className="w-24 text-right tabular-nums"
              autoFocus
            />
            {/* La nota se pide solo si alguien la quiere: la mayoría de los
                conteos no tienen nada que aclarar, y un campo más por delante
                convierte "poner 12" en dos decisiones. */}
            <Button
              type="button"
              variant={conNota ? "secondary" : "ghost"}
              size="icon"
              aria-label="Agregar una nota"
              onClick={() => setConNota((v) => !v)}
            >
              <StickyNote className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
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
