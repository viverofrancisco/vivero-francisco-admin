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

const FORMAS = [
  { value: "EF", label: "Efectivo" },
  { value: "TRA", label: "Transferencia" },
  { value: "TC", label: "Tarjeta de crédito" },
  { value: "CQ", label: "Cheque" },
];

/** Los datáfonos que reconoce Contífico. */
const DATAFONOS = [
  { value: "D", label: "Datafast" },
  { value: "M", label: "Medianet" },
  { value: "E", label: "Dataexpress" },
  { value: "P", label: "PlaceToPay" },
  { value: "A", label: "Alignet" },
];

interface CuentaOption {
  id: string;
  nombre: string;
  numero: string;
  tipo: string;
}

export interface FacturaCobrable {
  id: string;
  /** Lo que se muestra arriba: "001-002-000900007" o "Orden #91". */
  numero: string;
  total: number;
  saldo: number | null;
  /**
   * A dónde se postea. Por defecto, el cobro de una factura ya emitida.
   *
   * Una orden sin facturar apunta a `/api/ordenes/<id>/cobro`, que confirma,
   * emite y cobra de una: el cobro necesita un documento de Contífico contra el
   * cual registrarse, y quien cobra no tiene por qué crearlo primero.
   */
  url?: string;
}

/**
 * Registrar un cobro contra una factura.
 *
 * No hay "marcar como pagada": el estado sale de los cobros. Se puede cobrar en
 * partes, y la factura queda saldada cuando el saldo llega a cero. Los cobros
 * viven en Contífico; acá solo se mandan y se relee el saldo.
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
  const [forma, setForma] = useState("EF");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(() => hoyISOEcuador());
  const [numeroCheque, setNumeroCheque] = useState("");
  const [cuentaBancariaId, setCuentaBancariaId] = useState("");
  const [tipoPing, setTipoPing] = useState("D");
  const [numeroComprobante, setNumeroComprobante] = useState("");
  /** Cuentas del vivero, traídas de Contífico recién cuando hacen falta. */
  const [cuentas, setCuentas] = useState<CuentaOption[] | null>(null);
  const [pidiendoCuentas, setPidiendoCuentas] = useState(false);

  // Se piden al elegir transferencia y no al abrir: la mayoría de los cobros no
  // son transferencias, y es una llamada a Contífico.
  if (forma === "TRA" && cuentas === null && !pidiendoCuentas) {
    setPidiendoCuentas(true);
    fetch("/api/contifico/cuentas-bancarias")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "Error");
        return r.json();
      })
      .then((d: { cuentas: CuentaOption[] }) => setCuentas(d.cuentas))
      .catch(() => {
        setCuentas([]);
        toast.error("No pudimos traer las cuentas bancarias de Contífico");
      });
  }

  const saldo = factura?.saldo ?? factura?.total ?? 0;

  const guardar = async () => {
    const valor = Number(monto);
    if (!Number.isFinite(valor) || valor <= 0) {
      return toast.error("Ingresá un monto mayor a cero");
    }
    setGuardando(true);
    try {
      const res = await fetch(
        factura!.url ?? `/api/facturas/${factura!.id}/cobro`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formaCobro: forma,
            monto: valor,
            fecha: fecha || null,
            numeroCheque: forma === "CQ" ? numeroCheque || null : null,
            cuentaBancariaId: forma === "TRA" ? cuentaBancariaId || null : null,
            tipoPing: forma === "TC" ? tipoPing : null,
            numeroComprobante:
              forma === "TRA" ? numeroComprobante || null : null,
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
            {forma === "EF" && (
              <p className="text-xs text-muted-foreground">
                Un cobro en efectivo solo lleva monto y fecha: Contífico no
                guarda ninguna referencia ni nota para esta forma.
              </p>
            )}
          </div>

          {forma === "CQ" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Número de cheque</Label>
              <Input
                value={numeroCheque}
                onChange={(e) => setNumeroCheque(e.target.value)}
              />
            </div>
          )}

          {forma === "TRA" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Cuenta que recibió el dinero *</Label>
              <CustomSelect
                value={cuentaBancariaId}
                onChange={setCuentaBancariaId}
                options={(cuentas ?? []).map((c) => ({
                  value: c.id,
                  label: `${c.nombre} · ${c.numero}`,
                }))}
                placeholder={
                  cuentas === null ? "Cargando cuentas…" : "Elegí una cuenta"
                }
                disabled={cuentas === null}
                searchable
                searchPlaceholder="Buscar cuenta..."
              />
              <p className="text-xs text-muted-foreground">
                Son las cuentas <strong>del vivero</strong>, no del cliente:
                dónde cayó la transferencia.
              </p>
            </div>
          )}

          {forma === "TC" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Datáfono *</Label>
              <CustomSelect
                value={tipoPing}
                onChange={setTipoPing}
                options={DATAFONOS}
              />
            </div>
          )}

          {/* Solo en transferencia: es el único caso donde Contífico lo
              documenta y lo respeta. En efectivo lo pisa con su propia
              etiqueta, así que ofrecerlo era prometer algo que no se guarda. */}
          {forma === "TRA" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Comprobante</Label>
              <Input
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
                placeholder="Opcional"
              />
              <p className="text-xs text-muted-foreground">
                El número con el que el banco identifica la transferencia, para
                cruzarla después con el estado de cuenta.
              </p>
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
