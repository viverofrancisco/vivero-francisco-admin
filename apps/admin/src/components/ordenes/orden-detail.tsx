"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Loader2,
  MoreVertical,
  Send,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import {
  money,
  fecha,
  estadoLabel,
  estadoVariant,
  estadoCobro,
  cobroLabel,
  cobroVariant,
} from "./formato";
import {
  ESTADO_FACTURA_AYUDA,
  ESTADO_FACTURA_LABEL,
} from "@/components/facturas/estado";
import {
  OrdenLineasEditor,
  type LineaEditable,
  type ProductoCatalogo,
} from "./orden-lineas-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CobroDialog, type FacturaCobrable } from "./cobro-dialog";
import { CobrosCard } from "./cobros-card";
import { SelectorDatosFacturacion } from "@/components/facturacion/selector-datos-facturacion";

export interface ClienteOpcion {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
}

interface OrdenData {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  notas: string | null;
  /** Con qué se va a facturar; null = el predeterminado del cliente. */
  datoFacturacionId: string | null;
  subtotal: number;
  iva: number;
  total: number;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
    /** Cuántos datos de facturación tiene cargados: sin ninguno no se emite. */
    datosFacturacion: number;
  };
  lineas: {
    id: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    ivaTasa: number;
    total: number;
    periodoInicio: string | null;
    periodoFin: string | null;
    /** Procedencia: se conserva al editar, es lo que evita cobrar dos veces. */
    productoId: string;
    visitaProductoId: string | null;
    /** De qué visita salió la línea, cuando salió de una. */
    visita?: { id: string; fecha: string } | null;
    suscripcionItemId: string | null;
  }[];
  facturas: {
    id: string;
    numero: string;
    estado: string;
    fechaEmision: string;
    urlRide: string | null;
    total: number;
    anulada: boolean;
    /** Lo que falta cobrar, espejado de Contífico. */
    saldo: number | null;
    /** A nombre de quién salió, congelado al emitir. */
    razonSocial: string | null;
    identificacion: string | null;
    /** El id del documento en Contífico, para buscarlo allá. */
    contificoDocumentoId: string | null;
    /**
     * El resto de lo que se imprimió. La razón social y la identificación son
     * el snapshot —esos no se mueven—; dirección, teléfono y correo salen del
     * dato enlazado, que sí pudo editarse después.
     */
    datoFacturacion: {
      tipoIdentificacion: string;
      tipoPersona: string;
      direccion: string | null;
      telefono: string | null;
      email: string | null;
    } | null;
  }[];
}

export function OrdenDetail({
  orden,
  productos,
  clientes,
}: {
  orden: OrdenData;
  productos: ProductoCatalogo[];
  /** Para poder cambiar de cliente mientras la orden sea borrador. */
  clientes: ClienteOpcion[];
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  /** Anular no se deshace y puede soltar trabajo: siempre se confirma. */
  const [anulando, setAnulando] = useState(false);
  const [cobrando, setCobrando] = useState<FacturaCobrable | null>(null);

  /**
   * Una orden tiene una factura. Las anuladas quedan en el historial pero no
   * mandan sobre nada: todas las acciones apuntan a la que está viva.
   */
  const facturaVigente = orden.facturas.find((f) => !f.anulada) ?? null;

  /**
   * Cuándo todavía se puede anular.
   *
   * Dos cortes distintos. **Firmada ya no**: anular es un `PUT` y Contífico no
   * acepta cambios sobre un documento firmado, cosa que hace sola dentro de la
   * hora. **Cobrada del todo tampoco**: sería dejar la plata cobrada sin nada
   * que la respalde. Sin factura todavía, la orden se anula sin más.
   */
  const sePuedeAnular =
    facturaVigente === null ||
    (facturaVigente.estado === "PENDIENTE" &&
      (facturaVigente.saldo === null || facturaVigente.saldo > 0.001));

  /**
   * Con la factura emitida y cobrada no queda nada que hacerle a la orden desde
   * acá, y un menú vacío es peor que ninguno: promete opciones y no tiene.
   */
  const hayAccionesDeOrden = !facturaVigente || sePuedeAnular;

  /** Las líneas cuyo trabajo se libera al anular, para poder mostrarlas. */
  const lineasEnlazadas = orden.lineas.filter(
    (l) => l.visitaProductoId || l.suscripcionItemId
  );

  /**
   * Cobrar entra por la orden mientras no haya factura: el endpoint confirma,
   * emite y registra el cobro de una. Con la factura ya emitida va derecho
   * contra ella, que es lo que espera Contífico.
   */
  const abrirCobro = () => {
    setCobrando(
      facturaVigente
        ? {
            id: facturaVigente.id,
            numero: `Factura ${facturaVigente.numero}`,
            total: facturaVigente.total,
            saldo: facturaVigente.saldo,
          }
        : {
            id: orden.id,
            numero: `Orden #${orden.numero}`,
            total: orden.total,
            saldo: orden.total,
            url: `/api/ordenes/${orden.id}/cobro`,
          }
    );
  };

  const guardarEdicion = async (lineas: LineaEditable[], notas: string) => {
    setCargando("guardar");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notas: notas.trim() || null,
          lineas: lineas.map((l) => ({
            descripcion: l.descripcion.trim(),
            cantidad: Number(l.cantidad) || 1,
            precioUnitario: Number(l.precioUnitario),
            ivaTasa: Number(l.ivaTasa) || 0,
            productoId: l.productoId,
            visitaProductoId: l.visitaProductoId,
            suscripcionItemId: l.suscripcionItemId,
            periodoInicio: l.periodoInicio,
            periodoFin: l.periodoFin,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Orden actualizada");
      setEditando(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setCargando(null);
    }
  };

  // Sin datos de facturación cargados no se puede emitir. Se avisa acá y no al
  // apretar, para que no haya que descubrirlo dentro del diálogo.
  const faltaFacturacion = orden.cliente.datosFacturacion === 0;

  // La confirmación vive en el diálogo: además de avisar que es irreversible,
  // hay que elegir con qué datos se emite.
  const [datoFacturacion, setDatoFacturacion] = useState(orden.datoFacturacionId);

  /**
   * Cambiar de cliente arrastra todo lo que dependía del anterior: los datos de
   * facturación dejan de valer, así que se limpian en la misma llamada. El
   * servidor rechaza el cambio si quedan líneas del trabajo del cliente viejo.
   */
  const cambiarCliente = async (clienteId: string) => {
    if (clienteId === orden.cliente.id) return;
    setCargando("cliente");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, datoFacturacionId: null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      setDatoFacturacion(null);
      toast.success("Cliente actualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cambiar el cliente");
    } finally {
      setCargando(null);
    }
  };

  /** Se guarda al elegir, sin botón: es un solo campo. */
  const guardarDatoFacturacion = async (id: string | null) => {
    setDatoFacturacion(id);
    if (id === orden.datoFacturacionId) return;
    try {
      const res = await fetch(`/api/ordenes/${orden.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datoFacturacionId: id }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    }
  };

  const sincronizarFactura = async (facturaId: string) => {
    setCargando(facturaId);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/sincronizar`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Estado actualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(null);
    }
  };

  /**
   * Empuja la factura al SRI sin esperar el proceso horario de Contífico.
   *
   * No firma nada de nuestro lado: la firma la pone Contífico con el
   * certificado del vivero, y este endpoint solo apura la tanda. Sirve cuando
   * el cliente está esperando el comprobante y no dan ganas de esperar la hora.
   */
  const enviarAlSri = async (facturaId: string) => {
    setCargando(facturaId);
    try {
      const res = await fetch(`/api/facturas/${facturaId}/reenviar-sri`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Enviada al SRI");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(null);
    }
  };

  /**
   * Anula la orden y su factura de una. `liberarTrabajo` va siempre en true
   * porque el diálogo ya mostró qué se desenlaza: el chequeo del servidor está
   * para que nadie anule a ciegas, no para pedirlo dos veces.
   */
  const anularOrden = async () => {
    setCargando("anular");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/anular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liberarTrabajo: true }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Orden anulada");
      setAnulando(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(null);
    }
  };

  /** Emitir sin cobrar: la venta a crédito sigue siendo posible. */
  const facturarSinCobrar = async () => {
    setCargando("facturar");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/facturar`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      if (body.factura) {
        toast.success(`Factura ${body.factura.numero} emitida`);
      } else {
        // La orden se queda en borrador, editable, que es donde se arregla la
        // causa. No es un fracaso del pedido: es un aviso.
        toast.warning(`No se pudo emitir la factura: ${body.errorFactura}`);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/ordenes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Orden #{orden.numero}</h1>
            {/* Confirmada quiere decir "tiene factura", que ya se sabe con
                solo ver la card. Lo que cambia con el tiempo es el cobro. */}
            {facturaVigente && orden.estado === "CONFIRMADA" ? (
              <Badge
                variant={
                  cobroVariant[estadoCobro(orden.total, facturaVigente.saldo)]
                }
              >
                {cobroLabel[estadoCobro(orden.total, facturaVigente.saldo)]}
              </Badge>
            ) : (
              <Badge variant={estadoVariant[orden.estado] ?? "outline"}>
                {estadoLabel[orden.estado] ?? orden.estado}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {nombreCliente(orden.cliente)} · {fecha(orden.fecha)}
          </p>
        </div>
        {orden.estado !== "ANULADA" && !editando && (
          <div className="flex flex-none items-center gap-2">
            {orden.estado === "BORRADOR" && (
              <Button
                variant="outline"
                onClick={() => setEditando(true)}
                disabled={cargando !== null}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}

            {/* La acción principal en todos los estados. Por debajo emite la
                factura si falta y registra el cobro; el botón no lo cuenta
                porque para quien cobra es un solo movimiento. Con la factura
                saldada no queda nada que cobrar y desaparece. */}
            {(!facturaVigente ||
              facturaVigente.saldo === null ||
              facturaVigente.saldo > 0) && (
              <Button
                onClick={abrirCobro}
                disabled={cargando !== null || faltaFacturacion}
                title={
                  faltaFacturacion
                    ? "El cliente no tiene datos de facturación cargados."
                    : undefined
                }
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Registrar cobro
              </Button>
            )}

            {hayAccionesDeOrden && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Más acciones"
                    disabled={cargando !== null}
                  >
                    {cargando !== null ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MoreVertical className="h-4 w-4" />
                    )}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-60">
                {/* Facturar sin cobrar: la venta a crédito sigue existiendo. */}
                {!facturaVigente && (
                  <DropdownMenuItem
                    onClick={facturarSinCobrar}
                    disabled={faltaFacturacion}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Emitir factura sin cobrar
                  </DropdownMenuItem>
                )}

                {/* Lo de la factura no está acá: vive en el menú de su propia
                    card, que es de lo que habla. */}
                {sePuedeAnular && (
                  <DropdownMenuItem
                    onClick={() => setAnulando(true)}
                    className="text-destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Anular orden
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        )}
      </div>


      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Detalle</CardTitle>
          </CardHeader>
          <CardContent>
            {editando ? (
              <OrdenLineasEditor
                lineasIniciales={orden.lineas.map((l) => ({
                  uid: l.id,
                  descripcion: l.descripcion,
                  cantidad: String(l.cantidad),
                  precioUnitario: String(l.precioUnitario),
                  ivaTasa: String(l.ivaTasa),
                  productoId: l.productoId,
                  visitaProductoId: l.visitaProductoId,
                  suscripcionItemId: l.suscripcionItemId,
                  periodoInicio: l.periodoInicio,
                  periodoFin: l.periodoFin,
                }))}
                notasIniciales={orden.notas ?? ""}
                productos={productos}
                guardando={cargando === "guardar"}
                onGuardar={guardarEdicion}
                onCancelar={() => setEditando(false)}
              />
            ) : (
            <>
            <div className="divide-y">
              {orden.lineas.map((l) => (
                <div
                  key={l.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{l.descripcion}</p>
                    {/* El origen solo se muestra cuando la línea viene de
                        trabajo agendado o de un período: para una agregada a
                        mano no dice nada que no se vea. */}
                    <p className="text-xs text-muted-foreground">
                      {l.periodoInicio ? (
                        `Suscripción · ${fecha(l.periodoInicio)} → ${fecha(l.periodoFin!)} · `
                      ) : l.visita ? (
                        <>
                          <Link
                            href={`/dashboard/visitas/${l.visita.id}`}
                            className="text-primary hover:underline"
                          >
                            Visita del {fecha(l.visita.fecha)}
                          </Link>
                          {" · "}
                        </>
                      ) : l.visitaProductoId ? (
                        "Trabajo de una visita · "
                      ) : (
                        ""
                      )}
                      {`IVA ${l.ivaTasa}%`}
                    </p>
                  </div>
                  <span className="flex-none font-semibold tabular-nums">
                    {money(l.total)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(orden.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{money(orden.iva)}</span>
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(orden.total)}</span>
              </div>
            </div>
            </>
            )}
          </CardContent>
        </Card>

        {/* Los cobros van debajo del detalle y no en un popup: son parte de la
            historia de la orden, no una consulta aparte. Solo con factura
            emitida, porque los cobros viven colgados de ella en Contífico. */}
        {facturaVigente && (
          <div className="mt-6">
            <CobrosCard facturaId={facturaVigente.id} />
          </div>
        )}
        </div>

        <div className="space-y-6">
          {/* Editable solo en borrador: cambiar de cliente en una orden
              confirmada sería cambiar a quién se le cobra. */}
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {orden.estado === "BORRADOR" ? (
                <CustomSelect
                  value={orden.cliente.id}
                  onChange={cambiarCliente}
                  options={clientes.map((c) => ({
                    value: c.id,
                    label: nombreCliente(c),
                  }))}
                  placeholder="Seleccionar cliente"
                  searchable
                  searchPlaceholder="Buscar cliente..."
                />
              ) : (
                <Link
                  href={`/dashboard/clientes/${orden.cliente.id}`}
                  className="text-sm font-medium hover:underline"
                >
                  {nombreCliente(orden.cliente)}
                </Link>
              )}
            </CardContent>
          </Card>

        {/* Todo lo de la factura junto: el número que se busca en Contífico,
            en qué anda, y a nombre de quién salió. Los datos son el snapshot y
            no la ficha del cliente, que pudo editarse después. */}
        {facturaVigente && (
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Factura</CardTitle>
              <CardAction>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Acciones de la factura"
                        disabled={cargando !== null}
                      >
                        {cargando === facturaVigente.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreVertical className="h-4 w-4" />
                        )}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-60">
                    {/* El RIDE **no existe hasta que Contífico firma**, aunque
                        `url_ride` venga desde el momento de emitir: abrirla
                        antes lleva a "No se puede consultar el RIDE de un
                        documento que no esté firmado". Se muestra deshabilitada
                        en vez de esconderse, así se entiende que va a llegar. */}
                    <DropdownMenuItem
                      disabled={
                        !facturaVigente.urlRide ||
                        facturaVigente.estado === "PENDIENTE"
                      }
                      {...(facturaVigente.urlRide &&
                      facturaVigente.estado !== "PENDIENTE"
                        ? {
                            render: (
                              <a
                                href={facturaVigente.urlRide}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                          }
                        : {})}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {/* El aviso es nuestro y no un `title`: el nativo tarda
                          uno o dos segundos que fija el navegador y no se
                          pueden bajar. Va dentro de la fila —no flotando— para
                          que el `overflow` del menú no lo corte.
                          `pointer-events-auto` porque el ítem deshabilitado los
                          tiene apagados, y un hijo sí puede recuperarlos. */}
                      <span className="group/ride pointer-events-auto flex flex-1 cursor-default items-center justify-between gap-2">
                        Ver factura
                        {facturaVigente.estado === "PENDIENTE" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover/ride:opacity-100">
                            Falta firma
                          </span>
                        )}
                      </span>
                    </DropdownMenuItem>
                    {/* Contífico firma y transmite los pendientes cada hora;
                        esto no espera. Enviada o autorizada no hay nada que
                        apurar. */}
                    {(facturaVigente.estado === "PENDIENTE" ||
                      facturaVigente.estado === "FIRMADO") && (
                      <DropdownMenuItem
                        onClick={() => enviarAlSri(facturaVigente.id)}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Enviar al SRI ahora
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => sincronizarFactura(facturaVigente.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Actualizar desde Contífico
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1.5">
                {/* El id de Contífico: es con lo que se la busca por API y en
                    los enlaces de su sistema, y no aparece en ningún otro lado
                    del portal. */}
                {facturaVigente.contificoDocumentoId && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex-none text-muted-foreground">
                      ID Contífico
                    </span>
                    <ValorCopiable
                      valor={facturaVigente.contificoDocumentoId}
                      etiqueta="el ID de Contífico"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="flex-none text-muted-foreground">
                    Número
                  </span>
                  <ValorCopiable
                    valor={facturaVigente.numero}
                    etiqueta="el número de factura"
                    className="font-medium tabular-nums"
                  />
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>{fecha(facturaVigente.fechaEmision)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Estado</span>
                  <span title={ESTADO_FACTURA_AYUDA[facturaVigente.estado]}>
                    {ESTADO_FACTURA_LABEL[facturaVigente.estado] ??
                      facturaVigente.estado}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">
                    {money(facturaVigente.total)}
                  </span>
                </div>
                {/* Lo cobrado, no lo que falta: "Cobrada $0.00" se leía como
                    que no había entrado nada, justo cuando estaba todo pago.
                    Contífico da el saldo, así que lo cobrado se deriva. */}
                {facturaVigente.saldo !== null && (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Cobrado</span>
                      <span className="font-semibold tabular-nums text-primary">
                        {money(facturaVigente.total - facturaVigente.saldo)}
                      </span>
                    </div>
                    {facturaVigente.saldo > 0 && (
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">
                          Falta cobrar
                        </span>
                        <span className="font-semibold tabular-nums text-amber-700">
                          {money(facturaVigente.saldo)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Datos de facturación
                </p>
                <p className="font-medium">
                  {facturaVigente.razonSocial ?? "—"}
                </p>
                <FilaDato
                  etiqueta={
                    facturaVigente.datoFacturacion?.tipoIdentificacion === "RUC"
                      ? "RUC"
                      : "Cédula"
                  }
                  valor={facturaVigente.identificacion}
                />
                <FilaDato
                  etiqueta="Tipo"
                  valor={
                    facturaVigente.datoFacturacion
                      ? facturaVigente.datoFacturacion.tipoPersona === "JURIDICA"
                        ? "Persona jurídica"
                        : "Persona natural"
                      : null
                  }
                />
                <FilaDato
                  etiqueta="Dirección"
                  valor={facturaVigente.datoFacturacion?.direccion ?? null}
                />
                <FilaDato
                  etiqueta="Teléfono"
                  valor={facturaVigente.datoFacturacion?.telefono ?? null}
                />
                <FilaDato
                  etiqueta="Email"
                  valor={facturaVigente.datoFacturacion?.email ?? null}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* A nombre de quién sale la factura. Editable mientras sea borrador: una
            vez confirmada la orden, cambiarlo es cambiar lo que se va a cobrar. */}
        {orden.estado === "BORRADOR" && (
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Datos de facturación</CardTitle>
            </CardHeader>
            <CardContent>
              <SelectorDatosFacturacion
                clienteId={orden.cliente.id}
                value={datoFacturacion}
                onChange={guardarDatoFacturacion}
              />
            </CardContent>
          </Card>
        )}

          <Dialog
            open={anulando}
            onOpenChange={(v) => !v && setAnulando(false)}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Anular la orden #{orden.numero}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                {facturaVigente ? (
                  <p>
                    Se anula también su factura {facturaVigente.numero} en
                    Contífico, por {money(facturaVigente.total)}.
                  </p>
                ) : (
                  <p>La orden queda anulada y no se puede reabrir.</p>
                )}
                {/* La ventana se cierra sola: Contífico firma en su tanda
                    horaria y desde ahí no acepta más cambios. */}
                {facturaVigente && (
                  <p className="text-xs text-muted-foreground">
                    Se puede porque Contífico todavía no la firmó. Una vez
                    firmada, darla de baja es una nota de crédito.
                  </p>
                )}

                {/* Lo que no puede irse en silencio: si estas líneas se van con
                    la orden, su trabajo queda reservado por una orden muerta y
                    no vuelve a aparecer en pendientes nunca más. */}
                {lineasEnlazadas.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
                    <p className="font-medium">
                      Se desenlazan {lineasEnlazadas.length}{" "}
                      {lineasEnlazadas.length === 1 ? "línea" : "líneas"} y su
                      trabajo vuelve a quedar pendiente de facturar:
                    </p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                      {lineasEnlazadas.map((l) => (
                        <li key={l.id}>{l.descripcion}</li>
                      ))}
                    </ul>
                    <p className="mt-1.5">
                      Vas a poder meterlo en una orden nueva.
                    </p>
                  </div>
                )}

                <p className="rounded-md bg-muted/60 p-3 text-xs leading-snug">
                  No se puede deshacer desde el portal.
                </p>

                <div className="flex justify-end gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setAnulando(false)}
                    disabled={cargando !== null}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={anularOrden}
                    disabled={cargando !== null}
                  >
                    {cargando === "anular" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Anular orden
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <CobroDialog factura={cobrando} onClose={() => setCobrando(null)} />

        </div>
      </div>

    </div>
  );
}

/** Una fila etiqueta/valor de la card; se calla sola si el dato no está. */
function FilaDato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="flex-none text-muted-foreground">{etiqueta}</span>
      <span className="min-w-0 truncate text-right">{valor}</span>
    </div>
  );
}

/**
 * Un valor que se copia haciéndole click encima.
 *
 * Sin ícono al lado: el propio valor se resalta al pasar por arriba y el cursor
 * cambia a mano, que es lo que ya hace pensar «esto se puede tocar». El ícono
 * pedía apuntarle a un blanco de catorce píxeles al lado de lo que uno quería.
 *
 * Son datos que se pegan en Contífico para buscar el documento —quince dígitos
 * con guiones, o un hash— y transcribirlos a mano es garantía de errata.
 */
function ValorCopiable({
  valor,
  etiqueta,
  className = "",
}: {
  valor: string;
  /** Qué es, para el `title` y el lector de pantalla. */
  etiqueta: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      title={copiado ? "Copiado" : `Copiar ${etiqueta}`}
      aria-label={`Copiar ${etiqueta}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        } catch {
          toast.error("No pudimos copiar");
        }
      }}
      className={`group relative -mx-1 flex min-w-0 cursor-pointer rounded px-1 text-right transition-colors hover:bg-muted ${className}`}
    >
      <span className="truncate">{valor}</span>
      {/* El globito dice qué va a pasar antes del click y qué pasó después.
          Un tilde al costado empujaba el valor y solo servía para lo segundo. */}
      <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-sm group-hover:block group-focus-visible:block">
        {copiado ? "Copiado" : "Copiar"}
      </span>
    </button>
  );
}
