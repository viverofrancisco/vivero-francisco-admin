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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "./formato";
import { hoyISOEcuador } from "@/lib/fechas";
import { useEsMovil } from "@/lib/use-es-movil";

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
 *
 * En el escritorio es un diálogo; en el teléfono, la hoja desde abajo de la
 * app (`CobroSheet`): monto, forma de pago, fecha y referencia, con el botón
 * grande al pie. Los campos viven en `Contenido`, que se monta con el popup,
 * así cada apertura arranca con el saldo de **esta** factura.
 */
export function CobroDialog({
  factura,
  onClose,
}: {
  factura: FacturaCobrable | null;
  onClose: () => void;
}) {
  const esMovil = useEsMovil();
  const abierto = factura !== null;

  if (esMovil) {
    return (
      <Sheet open={abierto} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-[90dvh] gap-0 rounded-t-2xl p-0"
        >
          <SheetTitle className="sr-only">Registrar cobro</SheetTitle>
          {factura && <Contenido factura={factura} onClose={onClose} movil />}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
        </DialogHeader>
        {factura && <Contenido factura={factura} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({
  factura,
  onClose,
  movil = false,
}: {
  factura: FacturaCobrable;
  onClose: () => void;
  movil?: boolean;
}) {
  const router = useRouter();
  const saldo = factura.saldo ?? factura.total;
  const [guardando, setGuardando] = useState(false);
  const [forma, setForma] = useState(movil ? "TRANSFERENCIA" : "EFECTIVO");
  const [referencia, setReferencia] = useState("");
  // En el teléfono viene con el saldo puesto, como en la app: cobrar todo es
  // lo más común, y escribirlo con el pulgar invita a errarle por un centavo.
  const [monto, setMonto] = useState(movil ? saldo.toFixed(2) : "");
  const [fecha, setFecha] = useState(() => hoyISOEcuador());

  const guardar = async () => {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      return toast.error("Ingresa un monto mayor a cero");
    }
    setGuardando(true);
    try {
      const res = await fetch(
        factura.url ?? `/api/facturas/${factura.id}/cobro`,
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
      toast.error(
        e instanceof Error ? e.message : "No pudimos registrar el cobro"
      );
    } finally {
      setGuardando(false);
    }
  };

  if (movil) {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div>
          <p className="text-[17px] font-bold">Registrar cobro</p>
          <p className="text-sm text-muted-foreground">
            {factura.numero} · falta cobrar {money(saldo)}
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cobro-monto">Monto *</Label>
          <Input
            id="cobro-monto"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            inputMode="decimal"
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <Label>Forma de pago</Label>
          <CustomSelect
            value={forma}
            onChange={setForma}
            options={FORMAS}
            className="[&>button]:h-11 [&>button]:rounded-xl"
          />
        </div>
        <div className="space-y-1">
          <Label>Fecha</Label>
          <DatePicker
            value={fecha}
            onChange={setFecha}
            className="h-11 rounded-xl"
          />
        </div>
        {/* Una sola referencia en vez de un campo por forma de pago: el
            número de la transferencia, los últimos dígitos de la tarjeta. */}
        <div className="space-y-1">
          <Label htmlFor="cobro-referencia">Referencia</Label>
          <Input
            id="cobro-referencia"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="N.º de transferencia, cheque…"
            className="h-11 rounded-xl"
          />
        </div>
        <Button
          onClick={guardar}
          disabled={guardando}
          className="mt-2 h-[52px] w-full rounded-[14px] text-base font-semibold"
        >
          {guardando ? "Registrando…" : "Registrar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {factura.numero} · falta cobrar{" "}
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
  );
}
