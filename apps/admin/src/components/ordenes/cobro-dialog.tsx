"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "./formato";
import { hoyISOEcuador } from "@/lib/fechas";

/**
 * Las que usa la gente, no el catálogo del SRI: el pago no viaja a ningún lado
 * —la forma de pago se le declara al SRI **al emitir**— así que esto es la
 * cuenta corriente del vivero.
 */
const FORMAS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTRO", label: "Otro" },
];

export interface FacturaCobrable {
  id: string;
  /** Lo que se muestra arriba: "001-001-000000007" o "Orden #91". */
  numero: string;
  total: number;
  saldo: number | null;
  /**
   * A dónde se postea. Por defecto, el cobro de una factura ya emitida.
   *
   * Una orden sin facturar apunta a `/api/ordenes/<id>/cobro`, que emite y
   * cobra de una: el cobro se registra contra un comprobante, y quien cobra no
   * tiene por qué crearlo primero.
   */
  url?: string;
}

/**
 * Registrar un cobro contra una factura.
 *
 * No hay "marcar como pagada": el estado sale de la suma de los cobros. Se
 * puede cobrar en partes, y la factura queda saldada cuando el saldo llega a
 * cero.
 */
export function CobroDialog({
  factura,
  onClose,
}: {
  factura: FacturaCobrable | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [forma, setForma] = useState("EFECTIVO");
  const [referencia, setReferencia] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => hoyISOEcuador());

  const saldo = factura?.saldo ?? factura?.total ?? 0;

  const guardar = async () => {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      return toast.error("Ingresa un monto mayor a cero");
    }
    setGuardando(true);
    try {
      const res = await fetch(
        factura!.url ?? `/api/facturas/${factura!.id}/cobro`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formaPago: forma,
            monto: valor,
            fecha: fecha || null,
            referencia: referencia || null,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Cobro registrado");
      onClose();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos registrar el cobro");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={factura !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {factura?.numero} · falta cobrar{" "}
            <span className="font-semibold text-foreground">{money(saldo)}</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monto *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder={saldo.toFixed(2)}
              />
              {/* Cobrar todo es lo más común; escribirlo a mano invita a errarle
                  por un centavo y que la factura nunca cierre. */}
              <button
                type="button"
                onClick={() => setMonto(saldo.toFixed(2))}
                className="text-xs text-primary hover:underline"
              >
                Cobrar todo
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha</Label>
              <DatePicker value={fecha} onChange={setFecha} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Forma de cobro *</Label>
            <CustomSelect value={forma} onChange={setForma} options={FORMAS} />
          </div>

          {/* Una sola referencia en vez de un campo por forma de pago: el
              número de la transferencia, el del cheque o el del voucher son la
              misma cosa — con qué se encuentra ese pago. */}
          {forma !== "EFECTIVO" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Referencia</Label>
              <Input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="N° de transferencia, cheque o voucher"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar cobro
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
