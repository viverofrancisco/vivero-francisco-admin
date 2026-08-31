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
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  Loader2,
  Check,
  ChevronDown,
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
  hora,
  mismoDia,
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
  PERIODICIDAD_LABEL,
  estadoVariant as estadoSuscripcionVariant,
} from "@/components/suscripciones/formato";
import {
  OrdenLineasEditor,
  ORDEN_LINEAS_FORM_ID,
  type LineaEditable,
  type ProductoCatalogo,
} from "./orden-lineas-editor";
import {
  SelectorVisitas,
  rearmarPorVisitas,
  visitasDePendientes,
  type Pendiente,
} from "./selector-visitas";
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
import { AvisoSinVincular } from "./aviso-sin-vincular";

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
  /** Cuándo se creó de verdad. `fecha` es una columna DATE y no tiene hora. */
  createdAt: string;
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
  /**
   * De qué es la orden: de una visita, de un plan, o de nada.
   *
   * Nunca las dos —lo impide un CHECK— y sale de las columnas de la orden, no
   * de sus líneas: agregarle un producto a mano no la convierte en otra cosa.
   */
  /** De qué visitas es. Pueden ser varias: cobrar el mes entero en una orden. */
  visitas: { id: string; numero: number; fecha: string }[];
  suscripcion: {
    id: string;
    numero: number;
    periodicidad: string;
    estado: string;
  } | null;
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
    /** Si su producto está en Contífico. Sin eso no puede salir impreso. */
    productoVinculado: boolean;
    /** Qué trabajos paga la línea. Varios si el producto se hizo en más visitas. */
    visitaProductoIds: string[];
    /** De qué visitas salió, ya resueltas para poder linkearlas. */
    visitas: { id: string; numero: number; fecha: string }[];
    suscripcionItemId: string | null;
    /** De qué plan salió, cuando salió de un período. */
    suscripcionId?: string | null;
  }[];
  facturas: {
    id: string;
    numero: string;
    /** `NO_AUTORIZADO` = documento sin factura: no va al SRI y no lleva IVA. */
    tipo: "FACTURA" | "NO_AUTORIZADO";
    estado: string;
    /** Lo que salió impreso. Puede no tener la forma de las líneas de la orden. */
    lineas: {
      id: string;
      descripcion: string;
      detalle: string | null;
      cantidad: number;
      precioUnitario: number;
      ivaTasa: number;
      total: number;
    }[];
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
    /** Cuándo la emitió el portal. Con hora, a diferencia de `fechaEmision`. */
    createdAt: string;
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
  pendientes = [],
  backHref = "/dashboard/ordenes",
}: {
  orden: OrdenData;
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref?: string;
  productos: ProductoCatalogo[];
  /** Para poder cambiar de cliente mientras la orden sea borrador. */
  clientes: ClienteOpcion[];
  /**
   * Trabajo del cliente que el editor puede marcar, **incluido el de esta
   * orden**: es lo que permite desmarcar sus propias visitas.
   */
  pendientes?: Pendiente[];
}) {
  const router = useRouter();
  const [cargando, setCargando] = useState<string | null>(null);
  /**
   * Lo que se está editando vive acá y no en el editor de líneas porque el card
   * de **Visitas** —que está más abajo, fuera de él— trabaja sobre lo mismo:
   * marcar una visita cambia las líneas. En dos lugares habrían quedado en
   * desacuerdo.
   */
  const [lineasEdit, setLineasEdit] = useState<LineaEditable[]>([]);
  const [visitasEdit, setVisitasEdit] = useState<string[]>([]);
  const [notasEdit, setNotasEdit] = useState("");
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
   * Un documento sin factura no va al SRI: no tiene RIDE, ni firma que esperar,
   * ni estado que mostrar. Lo que sí tiene —y es lo que importa— es saldo.
   */
  const sinFactura = facturaVigente?.tipo === "NO_AUTORIZADO";

  /**
   * ¿El papel tiene otra forma que la orden?
   *
   * Solo entonces vale mostrar sus líneas: cuando son las mismas, repetirlas es
   * ruido. Lo normal acá es que difieran —varios trabajos se cobran como una
   * sola línea de "servicio de mantenimiento"— y en ese caso hay que poder ver
   * qué recibió el cliente sin salir de la orden.
   */
  const facturaDifiere =
    facturaVigente !== null &&
    facturaVigente.lineas.length > 0 &&
    (facturaVigente.lineas.length !== orden.lineas.length ||
      facturaVigente.lineas.some((f, i) => {
        const o = orden.lineas[i];
        return (
          f.descripcion !== o.descripcion ||
          f.detalle !== null ||
          f.cantidad !== o.cantidad ||
          f.precioUnitario !== o.precioUnitario ||
          f.ivaTasa !== o.ivaTasa
        );
      }));

  /**
   * El período que cubre la orden.
   *
   * Es **uno solo**: `ensureTrabajoCompleto` obliga a llevarse el período
   * entero, así que todas sus líneas de plan dicen lo mismo. Por eso va en la
   * card de la suscripción y no repetido en cada línea — a diferencia de las
   * visitas, que sí pueden ser varias y distintas por línea.
   */
  const periodo = orden.lineas.find((l) => l.periodoInicio && l.periodoFin);

  /** Con una sola tasa decirla en cada línea es ruido; con dos, es el dato. */
  const variasTasas =
    new Set(facturaVigente?.lineas.map((l) => l.ivaTasa) ?? []).size > 1;

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
  /**
   * Editar y anular viven en el menú; emitir y cobrar son botones propios
   * porque son la acción del momento. Sin nada adentro el menú no se dibuja —
   * un botón que abre un desplegable vacío es peor que no tenerlo.
   */
  const puedeEditar = orden.estado === "BORRADOR";
  const hayAccionesDeOrden = puedeEditar || sePuedeAnular;

  /**
   * Las líneas por procedencia: períodos de plan, trabajo de visitas y lo
   * agregado a mano. Una orden puede mezclar las tres —a un cliente se le
   * emite **una** factura, no una por origen— y agrupar es lo que hace que eso
   * se lea en vez de confundir.
   */
  const grupos = [
    {
      clave: "plan",
      titulo: "Períodos de suscripción",
      lineas: orden.lineas.filter((l) => l.periodoInicio),
    },
    {
      clave: "visitas",
      titulo: "Trabajo de visitas",
      lineas: orden.lineas.filter(
        (l) => !l.periodoInicio && l.visitaProductoIds.length > 0
      ),
    },
    {
      clave: "extra",
      titulo: "Agregado a mano",
      lineas: orden.lineas.filter(
        (l) => !l.periodoInicio && l.visitaProductoIds.length === 0
      ),
    },
  ].filter((g) => g.lineas.length > 0);
  const hayVariosOrigenes = grupos.length > 1;

  /** Las líneas cuyo trabajo se libera al anular, para poder mostrarlas. */
  const lineasEnlazadas = orden.lineas.filter(
    (l) => l.visitaProductoIds.length > 0 || l.suscripcionItemId
  );

  /**
   * Cobrar con la factura emitida va derecho contra ella, que es lo que espera
   * Contífico. **Sin factura pasa antes por el armador**: qué sale impreso es
   * una decisión —varios trabajos pueden ir como una sola línea de "servicio de
   * mantenimiento"— y tomarla por omisión desde un diálogo de cobro es tomarla
   * a ciegas. El cobro sigue estando a un paso: la pantalla termina en
   * "Emitir y cobrar".
   */
  const abrirCobro = () => {
    if (!facturaVigente) {
      router.push(`/dashboard/ordenes/${orden.id}/facturar`);
      return;
    }
    setCobrando({
      id: facturaVigente.id,
      numero: `Factura ${facturaVigente.numero}`,
      total: facturaVigente.total,
      saldo: facturaVigente.saldo,
    });
  };

  /** Abrir el editor con lo que la orden dice hoy. */
  const empezarAEditar = () => {
    setLineasEdit(
      orden.lineas.map((l) => ({
        uid: l.id,
        descripcion: l.descripcion,
        cantidad: String(l.cantidad),
        precioUnitario: String(l.precioUnitario),
        ivaTasa: String(l.ivaTasa),
        productoId: l.productoId,
        visitaProductoIds: l.visitaProductoIds,
        suscripcionItemId: l.suscripcionItemId,
        periodoInicio: l.periodoInicio,
        periodoFin: l.periodoFin,
      }))
    );
    setVisitasEdit(orden.visitas.map((v) => v.id));
    setNotasEdit(orden.notas ?? "");
    setEditando(true);
  };

  /** Marcar o desmarcar visitas: es cargar o sacar su trabajo. */
  const cambiarVisitas = (ids: string[]) => {
    setVisitasEdit(ids);
    setLineasEdit(rearmarPorVisitas(lineasEdit, ids, pendientes));
  };

  const guardarEdicion = async (lineas: LineaEditable[]) => {
    const notas = notasEdit;
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
            visitaProductoIds: l.visitaProductoIds,
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

  /**
   * Los productos de la orden que todavía no están en Contífico.
   *
   * La orden los acepta a propósito —registra lo que se vendió, y lo que tiene
   * que existir allá es lo que sale impreso— pero el armador no deja emitir una
   * línea sin vínculo, y eso se descubría recién adentro. Editando manda lo que
   * hay en pantalla, que puede tener productos recién agregados; mirando, lo
   * que resolvió el servidor con cada línea.
   */
  const sinVincular = (() => {
    const catalogo = new Map(productos.map((p) => [p.id, p]));
    const delServidor = new Map(
      orden.lineas.map((l) => [l.productoId, l.productoVinculado])
    );
    const mapa = new Map<string, { id: string; nombre: string }>();
    const actuales = editando
      ? lineasEdit.map((l) => ({ productoId: l.productoId, nombre: l.descripcion }))
      : orden.lineas.map((l) => ({ productoId: l.productoId, nombre: l.descripcion }));
    for (const l of actuales) {
      const p = catalogo.get(l.productoId);
      // El catálogo es lo que está al día; para una orden que ya no es borrador
      // no viene cargado, y ahí manda lo que trajo la línea.
      const vinculado = p
        ? p.contificoProductoId !== null
        : (delServidor.get(l.productoId) ?? true);
      if (!vinculado) {
        mapa.set(l.productoId, { id: l.productoId, nombre: p?.nombre ?? l.nombre });
      }
    }
    return [...mapa.values()];
  })();

  /**
   * Por qué no se puede emitir todavía, o `null` si se puede.
   *
   * Las dos razones apagan el mismo botón, así que se dicen en el mismo lugar:
   * con dos condiciones sueltas el botón quedaba apagado sin decir cuál de las
   * dos faltaba.
   */
  const motivoNoEmitir =
    faltaFacturacion && sinVincular.length > 0
      ? "El cliente no tiene datos de facturación cargados, y hay productos sin vincular con Contífico."
      : faltaFacturacion
        ? "El cliente no tiene datos de facturación cargados."
        : sinVincular.length > 0
          ? `${sinVincular.map((p) => `"${p.nombre}"`).join(", ")} ${
              sinVincular.length === 1
                ? "no está vinculado"
                : "no están vinculados"
            } con Contífico.`
          : null;

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
  const irAEmitir = () =>
    router.push(`/dashboard/ordenes/${orden.id}/facturar`);

  return (
    <div className="space-y-6">
      {/* Pegado arriba: las acciones viven acá —también Guardar y Cancelar
          mientras se edita— en vez de en una barra fija abajo, que le tapaba
          el contenido al resto de la página. Los márgenes negativos lo hacen
          sangrar hasta los bordes del contenedor con padding. */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 mb-6 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        {/* Vuelve de donde vino: llegar desde una visita y salir a la lista de
            órdenes es perder el lugar donde uno estaba. */}
        <Link href={backHref}>
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
            {mismoDia(orden.fecha, orden.createdAt) &&
              ` · ${hora(orden.createdAt)}`}
          </p>
        </div>
        {/* Editando, el encabezado pasa a ser la barra del formulario: el
            botón manda el `form` del editor, que vive más abajo en la página.
            Así guardar queda siempre a la vista sin tapar nada. */}
        {editando && (
          <div className="flex flex-none items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditando(false)}
              disabled={cargando === "guardar"}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form={ORDEN_LINEAS_FORM_ID}
              disabled={cargando === "guardar"}
            >
              {cargando === "guardar" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        )}

        {orden.estado !== "ANULADA" && !editando && (
          <div className="flex flex-none items-center gap-2">
            {/* La acción principal, y dice lo que hace en cada momento.
                Sin documento emitido lo que toca es emitirlo —el cobro se
                registra **contra** un documento de Contífico, así que antes no
                hay nada que cobrar— y con uno emitido, cobrarlo. Ofrecer
                "Registrar cobro" sobre un borrador prometía un paso que en
                realidad empezaba por otro lado. Saldada no queda nada y
                desaparece. */}
            {!facturaVigente ? (
              <Button
                onClick={irAEmitir}
                disabled={cargando !== null || motivoNoEmitir !== null}
                title={motivoNoEmitir ?? undefined}
              >
                <FileText className="mr-2 h-4 w-4" />
                Emitir factura
              </Button>
            ) : (
              (facturaVigente.saldo === null || facturaVigente.saldo > 0) && (
                <Button
                  onClick={abrirCobro}
                  disabled={cargando !== null}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  Registrar cobro
                </Button>
              )
            )}

            {/* "Acciones" y no tres puntitos: al lado de dos botones con
                nombre, un ícono solo obliga a abrirlo para saber qué hay. */}
            {hayAccionesDeOrden && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" disabled={cargando !== null}>
                      {cargando !== null ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Acciones
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-60">
                  {/* Lo de la factura no está acá: vive en el menú de su propia
                      card, que es de lo que habla. */}
                  {puedeEditar && (
                    <DropdownMenuItem onClick={empezarAEditar}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
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
            {/* Arriba del detalle: es lo que va a frenar la emisión, y
                enterarse recién adentro del armador —con la orden ya creada—
                era enterarse tarde. Con la factura emitida sobra: lo que salió
                impreso ya está decidido. */}
            {!facturaVigente &&
              orden.estado !== "ANULADA" &&
              sinVincular.length > 0 && (
                <div className="mb-4">
                  <AvisoSinVincular productos={sinVincular} />
                </div>
              )}
            {editando ? (
              <OrdenLineasEditor
                lineas={lineasEdit}
                onLineasChange={setLineasEdit}
                productos={productos}
                clienteNombre={nombreCliente(orden.cliente)}
                onGuardar={guardarEdicion}
              />
            ) : (
            <>
            {/* Agrupadas por procedencia. Sueltas quedaban un "Visita,
                Visita, Suscripción, Visita" sin estructura, y no se entendía
                de qué estaba hecha la orden. Los grupos aparecen solo cuando
                hay más de uno: con todo del mismo origen sobran los títulos. */}
            <div className="divide-y">
              {grupos.map(({ clave, titulo, lineas }) => (
                <div key={clave} className={hayVariosOrigenes ? "py-1" : ""}>
                  {hayVariosOrigenes && (
                    <p className="pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {titulo}
                    </p>
                  )}
                  <div className="divide-y">
              {lineas.map((l) => (
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
                      {/* La procedencia por su número, que es como la gente
                          la nombra en voz alta, y no por su fecha. Igual con
                          una que con cinco: la fecha ya está en la ficha a la
                          que lleva el link. */}
                      {l.periodoInicio ? (
                        <>
                          {l.suscripcionId ? (
                            <Link
                              href={`/dashboard/suscripciones/${l.suscripcionId}`}
                              className="text-primary hover:underline"
                            >
                              Suscripción{orden.suscripcion ? ` #${orden.suscripcion.numero}` : ""}
                            </Link>
                          ) : (
                            "Suscripción"
                          )}
                          {" · "}
                        </>
                      ) : l.visitas.length > 0 ? (
                        <>
                          {/* Varias cuando el mismo producto se hizo en más de
                              una visita: es una sola línea, y hay que poder ir
                              a cada una. Sin contarlas al lado: los links ya
                              son dos. */}
                          {l.visitas.map((v, i) => (
                            <span key={v.id}>
                              {i > 0 && ", "}
                              <Link
                                href={`/dashboard/visitas/${v.id}?from=/dashboard/ordenes/${orden.id}`}
                                className="text-primary hover:underline"
                              >
                                #{v.numero}
                              </Link>
                            </span>
                          ))}
                          {" · "}
                        </>
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

        {/* De qué es la orden. Antes solo se veía línea por línea, y una
            orden con un producto suelto agregado a mano no decía en ningún
            lado que igual era la de esa visita o la de ese plan. */}
        {/* Editando, esta card **es** el selector: marcar una visita carga su
            trabajo. Es la única forma de sacar lo de una visita, porque una
            visita se factura completa y sus productos no se quitan de a uno.
            No hay una segunda lista arriba: sería la misma cosa dos veces. */}
        {editando && !orden.suscripcion && (
          <div className="mt-6">
            <SelectorVisitas
              visitas={visitasDePendientes(pendientes)}
              marcadas={visitasEdit}
              onCambiar={cambiarVisitas}
              deshabilitado={lineasEdit.some((l) => l.suscripcionItemId)}
              motivoDeshabilitado="Esta orden es de un período de suscripción. El trabajo de una visita va en otra orden."
            />
          </div>
        )}

        {!editando && (orden.suscripcion || orden.visitas.length > 0) && (
          <Card className="mt-6">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                {orden.suscripcion
                  ? "Suscripción"
                  : orden.visitas.length === 1
                    ? "Visita"
                    : "Visitas"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orden.suscripcion ? (
                <Link
                  href={`/dashboard/suscripciones/${orden.suscripcion.id}?from=/dashboard/ordenes/${orden.id}`}
                  className="flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      Suscripción #{orden.suscripcion.numero}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {PERIODICIDAD_LABEL[orden.suscripcion.periodicidad] ??
                        orden.suscripcion.periodicidad}
                      {periodo &&
                        ` · ${fecha(periodo.periodoInicio!)} → ${fecha(periodo.periodoFin!)}`}
                    </span>
                  </span>
                  <Badge
                    variant={
                      estadoSuscripcionVariant[orden.suscripcion.estado] ??
                      "outline"
                    }
                    className="flex-none"
                  >
                    {orden.suscripcion.estado.charAt(0) +
                      orden.suscripcion.estado.slice(1).toLowerCase()}
                  </Badge>
                </Link>
              ) : (
                // Varias: una orden puede cubrir el mes entero de un cliente.
                <div className="space-y-1">
                  {orden.visitas.map((v) => (
                    <Link
                      key={v.id}
                      href={`/dashboard/visitas/${v.id}?from=/dashboard/ordenes/${orden.id}`}
                      className="block rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span className="block text-sm font-bold">
                        Visita #{v.numero}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {fecha(v.fecha)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
              <CardTitle className="text-base">
                {sinFactura ? "Documento" : "Factura"}
              </CardTitle>
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
                    {/* Un documento sin factura no tiene RIDE ni firma: la API
                        de Contífico no expone ningún PDF para ellos. Mostrarlo
                        deshabilitado prometería algo que no va a llegar. */}
                    {!sinFactura && (
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
                    )}
                    {/* Contífico firma y transmite los pendientes cada hora;
                        esto no espera. Enviada o autorizada no hay nada que
                        apurar. */}
                    {!sinFactura &&
                      (facturaVigente.estado === "PENDIENTE" ||
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
                {/* Una sola fila. `fechaEmision` es la fecha del documento
                    —la que ve el SRI, sin hora— y la hora sale de `createdAt`,
                    que es cuándo salió del portal. Se juntan solo si caen el
                    mismo día: si la orden tiene fecha vieja no son lo mismo y
                    mezclarlas sería inventar una hora que ese día no tuvo. */}
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Fecha</span>
                  <span>
                    {fecha(facturaVigente.fechaEmision)}
                    {mismoDia(
                      facturaVigente.fechaEmision,
                      facturaVigente.createdAt
                    ) && ` · ${hora(facturaVigente.createdAt)}`}
                  </span>
                </div>
                {sinFactura ? (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tipo</span>
                    <span title="No se envía al SRI y no lleva IVA. Se cobra y se anula igual que una factura.">
                      Consumidor final
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Estado</span>
                    <span title={ESTADO_FACTURA_AYUDA[facturaVigente.estado]}>
                      {ESTADO_FACTURA_LABEL[facturaVigente.estado] ??
                        facturaVigente.estado}
                    </span>
                  </div>
                )}
              </div>

              {facturaDifiere && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Lo que salió impreso
                  </p>
                  {facturaVigente.lineas.map((l) => (
                    <div key={l.id} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate">{l.descripcion}</span>
                        {/* El detalle sale al lado del nombre en el papel:
                            "SERVICIO DE MANTENIMIENTO · Detalle: AREAS VERDES". */}
                        {l.detalle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {l.detalle}
                          </span>
                        )}
                        {/* La tasa solo cuando hay más de una: agrupar deja
                            una línea por tasa, y sin decirlo se ven iguales. */}
                        {(l.cantidad !== 1 || variasTasas) && (
                          <span className="block text-xs text-muted-foreground">
                            {l.cantidad !== 1 && `${l.cantidad} × ${money(l.precioUnitario)}`}
                            {l.cantidad !== 1 && variasTasas && " · "}
                            {variasTasas && `IVA ${l.ivaTasa}%`}
                          </span>
                        )}
                      </span>
                      <span className="flex-none tabular-nums">
                        {money(l.total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

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

        {/* Al final de la columna y no arriba: las notas describen la orden, no
            lo que se vendió, así que van después de a quién se le factura y
            nunca en el medio del armado de las líneas. */}
        {editando && (
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notasEdit}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNotasEdit(e.target.value)
                }
                placeholder="Opcional"
                rows={3}
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
