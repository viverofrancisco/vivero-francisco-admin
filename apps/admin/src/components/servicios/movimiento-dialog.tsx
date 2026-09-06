"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, TriangleAlert } from "lucide-react";

export interface MovimientoFila {
  id: string;
  cantidad: number;
  saldo: number;
  motivo: string;
  nota: string | null;
  createdAt: string;
  createdByNombre: string | null;
}

const MOTIVO_LABEL: Record<string, string> = {
  INGRESO: "Entró mercadería",
  AJUSTE: "Corrección",
  CONTEO: "Conteo",
  VENTA: "Venta",
  DEVOLUCION: "Devolución",
};

/**
 * Mover el stock de una variante, con su historial a la vista.
 *
 * Las tres formas son tres preguntas distintas y por eso no comparten campo:
 * un ingreso dice *cuánto entró*, un ajuste *cuánto sumar o restar*, y un
 * conteo *cuánto hay*. Hacer que quien cuenta el estante calcule la diferencia
 * contra el sistema es pedirle la única cuenta que la máquina no puede errar.
 *
 * El historial va **acá adentro** y no en otra pantalla: cuando alguien está
 * por corregir un número, lo que le dice si confiar en él es ver qué pasó
 * antes — "AJUSTE −3 · rotas · anteayer" contesta la pregunta sin salir.
 */
export function MovimientoDialog({
  varianteId,
  nombre,
  stock,
  permiteNegativo,
  onCerrar,
  onHecho,
}: {
  varianteId: string;
  nombre: string;
  stock: number;
  permiteNegativo: boolean;
  onCerrar: () => void;
  onHecho: (stock: number) => void;
}) {
  const [motivo, setMotivo] = useState<"INGRESO" | "AJUSTE" | "CONTEO">("INGRESO");
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [historial, setHistorial] = useState<MovimientoFila[] | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);

  // Se dispara al renderizar con una variante nueva en vez de con un efecto:
  // no hay dependencias que sincronizar ni un `setState` después de pintar.
  if (pedido !== varianteId) {
    setPedido(varianteId);
    setHistorial(null);
    fetch(`/api/variantes/${varianteId}/movimientos`)
      .then((r) => r.json())
      .then((d) => setHistorial(d.movimientos ?? []))
      .catch(() => setHistorial([]));
  }

  const numero = Number(valor);
  const valido =
    valor.trim() !== "" &&
    Number.isFinite(numero) &&
    (motivo === "CONTEO" ? numero >= 0 : numero !== 0);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/variantes/${varianteId}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          motivo === "CONTEO"
            ? { motivo, contado: Math.trunc(numero), nota: nota || null }
            : { motivo, cantidad: Math.trunc(numero), nota: nota || null }
        ),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      // Un conteo que da lo mismo no mueve nada y el servidor devuelve `null`.
      onHecho(body.movimiento?.saldo ?? stock);
      toast.success("Stock actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ahora hay <span className="font-semibold text-foreground">{stock}</span>.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Qué pasó</Label>
            <CustomSelect
              value={motivo}
              onChange={(v) => setMotivo(v as typeof motivo)}
              options={[
                { value: "INGRESO", label: "Entró mercadería" },
                { value: "AJUSTE", label: "Corrección" },
                { value: "CONTEO", label: "Conté el estante" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {motivo === "CONTEO"
                ? "Cuántos hay *"
                : motivo === "INGRESO"
                  ? "Cuántos entraron *"
                  : "Cuánto sumar o restar *"}
            </Label>
            <Input
              type="number"
              step="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={motivo === "AJUSTE" ? "-2" : "0"}
              autoFocus
            />
            {motivo === "AJUSTE" && (
              <p className="text-xs text-muted-foreground">
                Negativo para restar: −2 saca dos.
              </p>
            )}
            {motivo === "CONTEO" && valido && (
              <p className="text-xs text-muted-foreground">
                Se anota la diferencia:{" "}
                {Math.trunc(numero) - stock >= 0 ? "+" : ""}
                {Math.trunc(numero) - stock}.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nota</Label>
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {!permiteNegativo && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
              Esta variante no se puede dejar en negativo.
            </p>
          )}

          {historial !== null && historial.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                Últimos movimientos
              </p>
              <ul className="max-h-44 space-y-1 overflow-y-auto">
                {historial.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">
                        {MOTIVO_LABEL[m.motivo] ?? m.motivo}
                      </span>
                      {m.nota && (
                        <span className="text-muted-foreground"> · {m.nota}</span>
                      )}
                      <span className="block text-muted-foreground">
                        {fechaCorta(m.createdAt)}
                        {m.createdByNombre ? ` · ${m.createdByNombre}` : ""}
                      </span>
                    </span>
                    <span className="flex-none tabular-nums">
                      <span
                        className={
                          m.cantidad > 0 ? "text-primary" : "text-amber-700"
                        }
                      >
                        {m.cantidad > 0 ? "+" : ""}
                        {m.cantidad}
                      </span>
                      <span className="ml-1.5 text-muted-foreground">
                        → {m.saldo}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || !valido}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
